from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from .. import models, schemas
from ..db import get_session
from ..services.sam_video import correct_track, propagate as propagate_svc

router = APIRouter(prefix="/projects/{project_id}/tracks", tags=["tracks"])


@router.get("", response_model=list[schemas.TrackRead])
def list_tracks(project_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(models.Track).where(models.Track.project_id == project_id).order_by(models.Track.id)
    ).all()
    return [
        schemas.TrackRead(id=t.id, class_id=t.class_id, label=t.label, color=t.color) for t in rows
    ]


@router.post("", response_model=schemas.TrackRead, status_code=status.HTTP_201_CREATED)
def create_track(
    project_id: int,
    payload: dict,
    session: Session = Depends(get_session),
):
    if "class_id" not in payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "class_id required")
    cls = session.get(models.Class, payload["class_id"])
    if not cls or cls.project_id != project_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid class_id")
    track = models.Track(
        project_id=project_id,
        class_id=payload["class_id"],
        label=payload.get("label"),
        color=payload.get("color") or cls.color,
    )
    session.add(track)
    session.commit()
    session.refresh(track)
    return schemas.TrackRead(
        id=track.id, class_id=track.class_id, label=track.label, color=track.color
    )


@router.post("/propagate")
def propagate(
    project_id: int,
    payload: schemas.PropagateRequest,
    session: Session = Depends(get_session),
):
    written = propagate_svc(session, project_id, payload)
    return {"written": written}


@router.post("/{track_id}/correct")
def correct(
    project_id: int,
    track_id: int,
    payload: schemas.CorrectionRequest,
    session: Session = Depends(get_session),
):
    track = session.get(models.Track, track_id)
    if not track or track.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "track not found")
    written = correct_track(session, project_id, track_id, payload)
    return {"written": written}
