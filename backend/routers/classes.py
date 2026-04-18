from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlmodel import Session, func, select

from .. import models, schemas
from ..db import get_session

router = APIRouter(prefix="/projects/{project_id}/classes", tags=["classes"])


@router.get("", response_model=list[schemas.ClassRead])
def list_classes(project_id: int, session: Session = Depends(get_session)):
    stmt = (
        select(models.Class, func.count(models.Annotation.id))
        .join(
            models.Annotation,
            models.Annotation.class_id == models.Class.id,
            isouter=True,
        )
        .where(models.Class.project_id == project_id)
        .group_by(models.Class.id)
        .order_by(models.Class.id)
    )
    return [
        schemas.ClassRead(id=c.id, name=c.name, color=c.color, annotation_count=count)
        for c, count in session.exec(stmt).all()
    ]


@router.post("", response_model=schemas.ClassRead, status_code=status.HTTP_201_CREATED)
def create_class(
    project_id: int,
    payload: schemas.ClassCreate,
    session: Session = Depends(get_session),
):
    if not session.get(models.Project, project_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    cls = models.Class(project_id=project_id, name=payload.name, color=payload.color)
    session.add(cls)
    session.commit()
    session.refresh(cls)
    return schemas.ClassRead(id=cls.id, name=cls.name, color=cls.color, annotation_count=0)


@router.patch("/{class_id}", response_model=schemas.ClassRead)
def update_class(
    project_id: int,
    class_id: int,
    payload: schemas.ClassUpdate,
    session: Session = Depends(get_session),
):
    cls = session.get(models.Class, class_id)
    if not cls or cls.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "class not found")

    if payload.name is not None and payload.name != cls.name:
        existing = session.exec(
            select(models.Class).where(
                models.Class.project_id == project_id,
                models.Class.name == payload.name,
                models.Class.id != class_id,
            )
        ).first()
        if existing:
            # Merge: move annotations + tracks from cls into existing, keep existing's color, drop cls.
            session.exec(
                update(models.Annotation)
                .where(
                    models.Annotation.project_id == project_id,
                    models.Annotation.class_id == class_id,
                )
                .values(class_id=existing.id)
            )
            session.exec(
                update(models.Track)
                .where(
                    models.Track.project_id == project_id,
                    models.Track.class_id == class_id,
                )
                .values(class_id=existing.id)
            )
            session.delete(cls)
            session.commit()
            session.refresh(existing)
            count = session.exec(
                select(func.count(models.Annotation.id)).where(
                    models.Annotation.class_id == existing.id
                )
            ).one()
            return schemas.ClassRead(
                id=existing.id,
                name=existing.name,
                color=existing.color,
                annotation_count=count,
            )
        cls.name = payload.name

    if payload.color is not None:
        cls.color = payload.color
    session.add(cls)
    session.commit()
    session.refresh(cls)
    count = session.exec(
        select(func.count(models.Annotation.id)).where(
            models.Annotation.class_id == class_id
        )
    ).one()
    return schemas.ClassRead(
        id=cls.id, name=cls.name, color=cls.color, annotation_count=count
    )


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(project_id: int, class_id: int, session: Session = Depends(get_session)):
    """Delete a class and cascade: all tracks + annotations using this class are removed."""
    cls = session.get(models.Class, class_id)
    if not cls or cls.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "class not found")

    anns = session.exec(
        select(models.Annotation).where(
            models.Annotation.project_id == project_id,
            models.Annotation.class_id == class_id,
        )
    ).all()
    for a in anns:
        session.delete(a)

    tracks = session.exec(
        select(models.Track).where(
            models.Track.project_id == project_id,
            models.Track.class_id == class_id,
        )
    ).all()
    for t in tracks:
        session.delete(t)

    session.delete(cls)
    session.commit()
