from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlmodel import Session

from .. import models
from ..db import get_session
from ..services.exporters import export_coco, export_voc, export_yolo

router = APIRouter(prefix="/projects/{project_id}", tags=["export"])


@router.get("/export")
def export_project(
    project_id: int,
    format: str = Query(..., pattern="^(yolo|coco|voc)$"),
    session: Session = Depends(get_session),
):
    if not session.get(models.Project, project_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    if format == "yolo":
        data = export_yolo(session, project_id)
    elif format == "coco":
        data = export_coco(session, project_id)
    else:
        data = export_voc(session, project_id)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=project_{project_id}_{format}.zip"},
    )
