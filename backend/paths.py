from __future__ import annotations

from pathlib import Path

from .config import PROJECTS_DIR
from .models import Frame, Project


def frame_abspath(frame: Frame) -> Path:
    return PROJECTS_DIR / frame.path


def project_video_abspath(project: Project) -> Path | None:
    return PROJECTS_DIR / project.video_path if project.video_path else None
