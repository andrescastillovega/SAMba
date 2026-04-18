from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from .. import models, schemas
from ..db import get_session
from ..paths import frame_abspath
from ..services.dedup import find_duplicate
from ..services.yolo_sahi import sliced_predict

router = APIRouter(prefix="/projects/{project_id}/frames", tags=["preannotate"])


def _ensure_class(session: Session, project_id: int, name: str, color: str) -> models.Class:
    cls = session.exec(
        select(models.Class).where(
            models.Class.project_id == project_id, models.Class.name == name
        )
    ).first()
    if cls:
        return cls
    cls = models.Class(project_id=project_id, name=name, color=color)
    session.add(cls)
    session.commit()
    session.refresh(cls)
    return cls


_AUTO_COLORS = [
    "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
    "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
]


@router.post("/{idx}/preannotate", response_model=list[schemas.AnnotationRead])
def preannotate(project_id: int, idx: int, session: Session = Depends(get_session)):
    frame = session.exec(
        select(models.Frame).where(
            models.Frame.project_id == project_id, models.Frame.idx == idx
        )
    ).first()
    if not frame:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "frame not found")

    detections = sliced_predict(frame_abspath(frame))

    created: list[models.Annotation] = []
    for det in detections:
        bbox = (det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"])
        if find_duplicate(session, project_id, frame.id, bbox, also_consider=created):
            continue
        cls = _ensure_class(
            session,
            project_id,
            det["class_name"],
            _AUTO_COLORS[det["class_id"] % len(_AUTO_COLORS)],
        )
        ann = models.Annotation(
            project_id=project_id,
            frame_id=frame.id,
            class_id=cls.id,
            bbox_x1=bbox[0],
            bbox_y1=bbox[1],
            bbox_x2=bbox[2],
            bbox_y2=bbox[3],
            source=models.AnnotationSource.auto,
            confidence=det["confidence"],
        )
        session.add(ann)
        created.append(ann)
    session.commit()
    for a in created:
        session.refresh(a)
    return [schemas.AnnotationRead(**a.model_dump()) for a in created]
