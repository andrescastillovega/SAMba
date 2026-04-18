from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

from .. import models, schemas
from ..db import get_session

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=schemas.ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: schemas.ProjectCreate, session: Session = Depends(get_session)):
    project = models.Project(name=payload.name)
    session.add(project)
    session.commit()
    session.refresh(project)
    return schemas.ProjectRead(**project.model_dump(), frame_count=0)


@router.get("", response_model=list[schemas.ProjectRead])
def list_projects(session: Session = Depends(get_session)):
    rows = session.exec(select(models.Project).order_by(models.Project.created_at.desc())).all()
    out: list[schemas.ProjectRead] = []
    for p in rows:
        count = session.exec(
            select(func.count(models.Frame.id)).where(models.Frame.project_id == p.id)
        ).one()
        out.append(schemas.ProjectRead(**p.model_dump(), frame_count=count))
    return out


@router.get("/{project_id}", response_model=schemas.ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(models.Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    count = session.exec(
        select(func.count(models.Frame.id)).where(models.Frame.project_id == project_id)
    ).one()
    return schemas.ProjectRead(**project.model_dump(), frame_count=count)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(models.Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    session.delete(project)
    session.commit()
