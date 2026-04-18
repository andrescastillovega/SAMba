from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session

from .. import models, schemas
from ..config import PROJECTS_DIR
from ..db import get_session
from ..services.ffmpeg import extract_frames, probe_video

router = APIRouter(prefix="/projects/{project_id}", tags=["videos"])


@router.post("/video", response_model=schemas.ProjectRead)
async def upload_video(
    project_id: int,
    stride: int = 1,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    project = session.get(models.Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")

    proj_dir = PROJECTS_DIR / str(project_id)
    frames_dir = proj_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    video_path = proj_dir / (file.filename or "video.mp4")
    data = await file.read()
    video_path.write_bytes(data)

    meta = probe_video(video_path)
    project.video_path = str(video_path.relative_to(PROJECTS_DIR))
    project.fps = meta.get("fps")
    project.width = meta.get("width")
    project.height = meta.get("height")

    frames = extract_frames(video_path, frames_dir, stride=stride)
    for idx, path, (w, h) in frames:
        session.add(
            models.Frame(
                project_id=project_id,
                idx=idx,
                path=str(path.relative_to(PROJECTS_DIR)),
                width=w,
                height=h,
            )
        )
    session.add(project)
    session.commit()
    session.refresh(project)

    return schemas.ProjectRead(**project.model_dump(), frame_count=len(frames))


@router.post("/ingest_folder", response_model=schemas.ProjectRead)
def ingest_folder(
    project_id: int,
    folder: str,
    session: Session = Depends(get_session),
):
    """Dev convenience: index an existing folder of frames without re-encoding."""
    from pathlib import Path

    from PIL import Image

    project = session.get(models.Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    src = Path(folder).expanduser().resolve()
    if not src.is_dir():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"not a directory: {src}")

    frames_dir = PROJECTS_DIR / str(project_id) / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    paths = sorted(p for p in src.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    for idx, path in enumerate(paths):
        with Image.open(path) as img:
            w, h = img.size
        link = frames_dir / path.name
        if not link.exists():
            link.symlink_to(path)
        session.add(
            models.Frame(
                project_id=project_id,
                idx=idx,
                path=str(link.relative_to(PROJECTS_DIR)),
                width=w,
                height=h,
            )
        )
    if paths:
        with Image.open(paths[0]) as img:
            project.width, project.height = img.size
        session.add(project)
    session.commit()
    session.refresh(project)
    return schemas.ProjectRead(**project.model_dump(), frame_count=len(paths))
