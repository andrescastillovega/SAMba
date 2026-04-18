from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from .. import models, schemas
from ..db import get_session
from ..services.dedup import find_duplicate

router = APIRouter(prefix="/projects/{project_id}/annotations", tags=["annotations"])


def _to_read(a: models.Annotation) -> schemas.AnnotationRead:
    return schemas.AnnotationRead(**a.model_dump())


@router.get("", response_model=list[schemas.AnnotationRead])
def list_annotations(
    project_id: int,
    frame_idx: int | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(models.Annotation).where(models.Annotation.project_id == project_id)
    if frame_idx is not None:
        frame = session.exec(
            select(models.Frame).where(
                models.Frame.project_id == project_id, models.Frame.idx == frame_idx
            )
        ).first()
        if not frame:
            return []
        stmt = stmt.where(models.Annotation.frame_id == frame.id)
    return [_to_read(a) for a in session.exec(stmt).all()]


@router.post("", response_model=schemas.AnnotationRead, status_code=status.HTTP_201_CREATED)
def create_annotation(
    project_id: int,
    payload: schemas.AnnotationCreate,
    session: Session = Depends(get_session),
):
    bbox = (payload.bbox_x1, payload.bbox_y1, payload.bbox_x2, payload.bbox_y2)
    duplicate = find_duplicate(session, project_id, payload.frame_id, bbox)
    if duplicate:
        # An overlapping annotation already exists — return it instead of stacking.
        return _to_read(duplicate)
    ann = models.Annotation(project_id=project_id, **payload.model_dump())
    session.add(ann)
    session.commit()
    session.refresh(ann)
    return _to_read(ann)


@router.patch("/{annotation_id}", response_model=schemas.AnnotationRead)
def update_annotation(
    project_id: int,
    annotation_id: int,
    payload: schemas.AnnotationPatch,
    session: Session = Depends(get_session),
):
    ann = session.get(models.Annotation, annotation_id)
    if not ann or ann.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "annotation not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ann, key, value)
    session.add(ann)
    session.commit()
    session.refresh(ann)
    return _to_read(ann)


@router.delete("/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_annotation(
    project_id: int,
    annotation_id: int,
    session: Session = Depends(get_session),
):
    ann = session.get(models.Annotation, annotation_id)
    if not ann or ann.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "annotation not found")
    session.delete(ann)
    session.commit()
