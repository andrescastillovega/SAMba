"""IoU-based dedup for auto-generated annotations.

Skip creating a new box when an existing annotation on the same frame already
covers (IoU >= threshold) the same region, regardless of class. Prevents YOLO
pre-annotate + SAM text_detect + SAM point commits from stacking duplicates.
"""
from __future__ import annotations

from sqlmodel import Session, select

from .. import models

DEDUP_IOU_THRESHOLD = 0.8


def iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    a_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    b_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = a_area + b_area - inter
    return inter / union if union > 0 else 0.0


def find_duplicate(
    session: Session,
    project_id: int,
    frame_id: int,
    bbox: tuple[float, float, float, float],
    threshold: float = DEDUP_IOU_THRESHOLD,
    also_consider: list[models.Annotation] | None = None,
) -> models.Annotation | None:
    """Return an existing annotation on this frame with IoU >= threshold, or None.

    `also_consider` is an in-memory list that isn't yet committed to the DB (used
    inside bulk inserters so the N-th proposed box doesn't collide with the N-1-th).
    """
    existing = session.exec(
        select(models.Annotation).where(
            models.Annotation.project_id == project_id,
            models.Annotation.frame_id == frame_id,
        )
    ).all()
    candidates = list(existing) + (also_consider or [])
    for ann in candidates:
        score = iou(bbox, (ann.bbox_x1, ann.bbox_y1, ann.bbox_x2, ann.bbox_y2))
        if score >= threshold:
            return ann
    return None
