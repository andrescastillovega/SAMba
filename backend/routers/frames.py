from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from .. import models, schemas
from ..db import get_session
from ..paths import frame_abspath

router = APIRouter(prefix="/projects/{project_id}/frames", tags=["frames"])


@router.get("", response_model=list[schemas.FrameRead])
def list_frames(project_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(models.Frame)
        .where(models.Frame.project_id == project_id)
        .order_by(models.Frame.idx)
    ).all()
    return [schemas.FrameRead(id=f.id, idx=f.idx, width=f.width, height=f.height) for f in rows]


def _get_frame(session: Session, project_id: int, idx: int) -> models.Frame:
    frame = session.exec(
        select(models.Frame).where(
            models.Frame.project_id == project_id,
            models.Frame.idx == idx,
        )
    ).first()
    if not frame:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "frame not found")
    return frame


@router.get("/{idx}/image")
def get_frame_image(project_id: int, idx: int, session: Session = Depends(get_session)):
    frame = _get_frame(session, project_id, idx)
    return FileResponse(frame_abspath(frame))
