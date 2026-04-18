from __future__ import annotations

from pydantic import BaseModel, Field

from .models import AnnotationSource


class ProjectCreate(BaseModel):
    name: str


class ProjectRead(BaseModel):
    id: int
    name: str
    fps: float | None = None
    width: int | None = None
    height: int | None = None
    video_path: str | None = None
    frame_count: int = 0


class ClassCreate(BaseModel):
    name: str
    color: str


class ClassUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class ClassRead(BaseModel):
    id: int
    name: str
    color: str
    annotation_count: int = 0


class FrameRead(BaseModel):
    id: int
    idx: int
    width: int
    height: int


class AnnotationBase(BaseModel):
    class_id: int
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    rbbox_cx: float | None = None
    rbbox_cy: float | None = None
    rbbox_w: float | None = None
    rbbox_h: float | None = None
    rbbox_theta: float | None = None
    polygon_json: str | None = None
    track_id: int | None = None
    source: AnnotationSource = AnnotationSource.manual
    confidence: float | None = None


class AnnotationCreate(AnnotationBase):
    frame_id: int


class AnnotationPatch(BaseModel):
    class_id: int | None = None
    bbox_x1: float | None = None
    bbox_y1: float | None = None
    bbox_x2: float | None = None
    bbox_y2: float | None = None
    rbbox_cx: float | None = None
    rbbox_cy: float | None = None
    rbbox_w: float | None = None
    rbbox_h: float | None = None
    rbbox_theta: float | None = None
    polygon_json: str | None = None
    track_id: int | None = None
    source: AnnotationSource | None = None
    confidence: float | None = None


class AnnotationRead(AnnotationBase):
    id: int
    frame_id: int


class SamPoint(BaseModel):
    x: float
    y: float
    label: int = Field(ge=0, le=1, description="1=foreground, 0=background")


class SamClickRequest(BaseModel):
    points: list[SamPoint] = []
    box: list[float] | None = Field(default=None, description="[x1,y1,x2,y2]")
    multimask: bool = True


class SamClickResponse(BaseModel):
    mask_polygon: list[list[float]]
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    rbbox_cx: float
    rbbox_cy: float
    rbbox_w: float
    rbbox_h: float
    rbbox_theta: float
    score: float


class HealthResponse(BaseModel):
    device: str
    cuda: bool
    yolo_loaded: bool
    sam_image_loaded: bool
