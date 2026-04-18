from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel, UniqueConstraint


class AnnotationSource(str, Enum):
    auto = "auto"
    manual = "manual"
    propagated = "propagated"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    fps: float | None = None
    width: int | None = None
    height: int | None = None
    video_path: str | None = None
    created_at: datetime = Field(default_factory=_now)


class Frame(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("project_id", "idx", name="uq_frame_project_idx"),)

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    idx: int
    path: str
    width: int
    height: int


class Class(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str
    color: str


class Track(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    class_id: int = Field(foreign_key="class.id")
    label: str | None = None
    color: str | None = None


class Annotation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    frame_id: int = Field(foreign_key="frame.id", index=True)
    track_id: int | None = Field(default=None, foreign_key="track.id", index=True)
    class_id: int = Field(foreign_key="class.id")

    # axis-aligned bbox (pixels, image coords)
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float

    # optional rotated bbox
    rbbox_cx: float | None = None
    rbbox_cy: float | None = None
    rbbox_w: float | None = None
    rbbox_h: float | None = None
    rbbox_theta: float | None = None

    polygon_json: str | None = None
    source: AnnotationSource = Field(default=AnnotationSource.manual)
    confidence: float | None = None
    created_at: datetime = Field(default_factory=_now)
