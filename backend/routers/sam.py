from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from .. import models, schemas
from ..db import get_session
from ..paths import frame_abspath
from ..services.dedup import find_duplicate
from ..services.sam_image import predict_from_points, predict_from_text

router = APIRouter(prefix="/projects/{project_id}/frames", tags=["sam"])


def _get_frame(session: Session, project_id: int, idx: int) -> models.Frame:
    frame = session.exec(
        select(models.Frame).where(
            models.Frame.project_id == project_id, models.Frame.idx == idx
        )
    ).first()
    if not frame:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "frame not found")
    return frame


@router.post("/{idx}/sam_click", response_model=schemas.SamClickResponse)
def sam_click(
    project_id: int,
    idx: int,
    payload: schemas.SamClickRequest,
    session: Session = Depends(get_session),
):
    frame = _get_frame(session, project_id, idx)
    points = [(p.x, p.y) for p in payload.points]
    labels = [p.label for p in payload.points]
    bbox, score = predict_from_points(frame_abspath(frame), points, labels, payload.box)
    if not bbox:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "empty mask")
    return schemas.SamClickResponse(
        mask_polygon=bbox["polygon"],
        bbox_x1=bbox["bbox_x1"],
        bbox_y1=bbox["bbox_y1"],
        bbox_x2=bbox["bbox_x2"],
        bbox_y2=bbox["bbox_y2"],
        rbbox_cx=bbox["rbbox_cx"],
        rbbox_cy=bbox["rbbox_cy"],
        rbbox_w=bbox["rbbox_w"],
        rbbox_h=bbox["rbbox_h"],
        rbbox_theta=bbox["rbbox_theta"],
        score=score,
    )


class TextDetectRequest(BaseModel):
    prompt: str
    class_id: int | None = None
    oriented: bool = False


@router.post("/{idx}/text_detect", response_model=list[schemas.AnnotationRead])
def text_detect(
    project_id: int,
    idx: int,
    payload: TextDetectRequest,
    session: Session = Depends(get_session),
):
    frame = _get_frame(session, project_id, idx)

    class_id = payload.class_id
    if class_id is None:
        cls = session.exec(
            select(models.Class).where(
                models.Class.project_id == project_id, models.Class.name == payload.prompt
            )
        ).first()
        if not cls:
            cls = models.Class(project_id=project_id, name=payload.prompt, color="#38bdf8")
            session.add(cls)
            session.commit()
            session.refresh(cls)
        class_id = cls.id

    detections = predict_from_text(frame_abspath(frame), payload.prompt)
    created: list[models.Annotation] = []
    for det in detections:
        bbox = (det["bbox_x1"], det["bbox_y1"], det["bbox_x2"], det["bbox_y2"])
        if find_duplicate(session, project_id, frame.id, bbox, also_consider=created):
            continue
        ann = models.Annotation(
            project_id=project_id,
            frame_id=frame.id,
            class_id=class_id,
            bbox_x1=bbox[0],
            bbox_y1=bbox[1],
            bbox_x2=bbox[2],
            bbox_y2=bbox[3],
            rbbox_cx=det["rbbox_cx"] if payload.oriented else None,
            rbbox_cy=det["rbbox_cy"] if payload.oriented else None,
            rbbox_w=det["rbbox_w"] if payload.oriented else None,
            rbbox_h=det["rbbox_h"] if payload.oriented else None,
            rbbox_theta=det["rbbox_theta"] if payload.oriented else None,
            source=models.AnnotationSource.auto,
            confidence=det.get("score", 1.0),
        )
        session.add(ann)
        created.append(ann)
    session.commit()
    for a in created:
        session.refresh(a)
    return [schemas.AnnotationRead(**a.model_dump()) for a in created]


@router.post("/{idx}/refine_to_rotated", response_model=list[schemas.AnnotationRead])
def refine_to_rotated(
    project_id: int,
    idx: int,
    session: Session = Depends(get_session),
):
    frame = _get_frame(session, project_id, idx)
    anns = session.exec(
        select(models.Annotation).where(
            models.Annotation.project_id == project_id,
            models.Annotation.frame_id == frame.id,
        )
    ).all()

    updated: list[models.Annotation] = []
    image_path = frame_abspath(frame)
    for a in anns:
        box = [a.bbox_x1, a.bbox_y1, a.bbox_x2, a.bbox_y2]
        bbox, _ = predict_from_points(image_path, points=[], labels=[], box=box)
        if not bbox:
            continue
        a.rbbox_cx = bbox["rbbox_cx"]
        a.rbbox_cy = bbox["rbbox_cy"]
        a.rbbox_w = bbox["rbbox_w"]
        a.rbbox_h = bbox["rbbox_h"]
        a.rbbox_theta = bbox["rbbox_theta"]
        a.polygon_json = json.dumps(bbox["polygon"])
        session.add(a)
        updated.append(a)

    session.commit()
    for a in updated:
        session.refresh(a)
    return [schemas.AnnotationRead(**a.model_dump()) for a in updated]
