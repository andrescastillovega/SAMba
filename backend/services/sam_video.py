"""Thin Modal client for SAM 3 video propagation.

The backend previously hosted the SAM 3 video predictor locally, which OOMs on
small GPUs. Now it delegates to the Sam3Video class in `app/sam3_modal.py`
(deployed with `modal deploy`). Each propagation call:

  1. Loads the frames in [start_frame, end_frame] from the local filesystem.
  2. POSTs them plus the prompts to Modal.
  3. Writes back per-frame propagated annotations in a single transaction.

Session state is not preserved between calls — each propagation is an
independent request. For drift correction, we seed a new propagation from the
corrective frame using a fresh prompt.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from threading import Lock

from sqlmodel import Session, select

from .. import models, schemas
from ..config import MODAL_SAM3_APP_NAME

_lock = Lock()


@lru_cache(maxsize=1)
def _sam3_video_cls():
    import modal

    Cls = modal.Cls.from_name(MODAL_SAM3_APP_NAME, "Sam3Video")
    return Cls()


def reset_state(project_id: int):  # retained for API compatibility
    """No-op — the Modal service is stateless between calls."""
    return


def _frames_in_window(
    session: Session, project_id: int, start: int, end: int
) -> list[models.Frame]:
    return session.exec(
        select(models.Frame)
        .where(
            models.Frame.project_id == project_id,
            models.Frame.idx >= start,
            models.Frame.idx <= end,
        )
        .order_by(models.Frame.idx)
    ).all()


_ANNOTATION_BBOX_FIELDS = {
    "bbox_x1",
    "bbox_y1",
    "bbox_x2",
    "bbox_y2",
    "rbbox_cx",
    "rbbox_cy",
    "rbbox_w",
    "rbbox_h",
    "rbbox_theta",
}


def _clean_bbox_payload(bbox: dict) -> tuple[dict, float | None]:
    """Split a Modal result into (annotation fields, confidence).

    Modal returns extra keys like `score`, `polygon`, and potentially others
    that are not columns on `Annotation`. Whitelist known fields and fold
    `score` into `confidence`.
    """
    fields = {k: v for k, v in bbox.items() if k in _ANNOTATION_BBOX_FIELDS}
    confidence = bbox.get("score")
    if confidence is not None:
        confidence = float(confidence)
    return fields, confidence


def _write_annotation(
    session: Session,
    project_id: int,
    frame_id: int,
    track_id: int,
    class_id: int,
    bbox: dict,
    source: models.AnnotationSource,
):
    fields, confidence = _clean_bbox_payload(bbox)
    existing = session.exec(
        select(models.Annotation).where(
            models.Annotation.project_id == project_id,
            models.Annotation.frame_id == frame_id,
            models.Annotation.track_id == track_id,
        )
    ).first()
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        existing.source = source
        if confidence is not None:
            existing.confidence = confidence
        existing.polygon_json = None
        session.add(existing)
        return existing
    ann = models.Annotation(
        project_id=project_id,
        frame_id=frame_id,
        track_id=track_id,
        class_id=class_id,
        source=source,
        confidence=confidence,
        **fields,
    )
    session.add(ann)
    return ann


def _build_prompts_from_payload(
    payload_objects, base_idx: int
) -> tuple[list[dict], dict[int, int]]:
    prompts: list[dict] = []
    track_to_class: dict[int, int] = {}
    for obj in payload_objects:
        track_to_class[obj.track_id] = obj.class_id
        prompts.append(
            {
                "frame_idx": obj.frame_idx - base_idx,
                "obj_id": obj.track_id,
                "points": [[p.x, p.y] for p in obj.points] if obj.points else None,
                "labels": [p.label for p in obj.points] if obj.points else None,
                "box": list(obj.box) if obj.box else None,
            }
        )
    return prompts, track_to_class


def _seed_from_existing(
    session: Session, project_id: int, start_frame: int
) -> tuple[list[dict], dict[int, int]]:
    """Fallback: seed prompts from every annotation on start_frame.

    Untracked annotations get a fresh Track row so propagation can carry them
    forward under a stable identity.
    """
    rows = session.exec(
        select(models.Annotation, models.Frame).where(
            models.Annotation.project_id == project_id,
            models.Annotation.frame_id == models.Frame.id,
            models.Frame.idx == start_frame,
        )
    ).all()
    prompts: list[dict] = []
    track_to_class: dict[int, int] = {}
    for ann, _frame in rows:
        if ann.track_id is None:
            track = models.Track(project_id=project_id, class_id=ann.class_id)
            session.add(track)
            session.flush()
            ann.track_id = track.id
            session.add(ann)
        track_to_class[ann.track_id] = ann.class_id
        prompts.append(
            {
                "frame_idx": 0,
                "obj_id": ann.track_id,
                "box": [ann.bbox_x1, ann.bbox_y1, ann.bbox_x2, ann.bbox_y2],
            }
        )
    if prompts:
        session.flush()
    return prompts, track_to_class


def propagate(
    session: Session,
    project_id: int,
    payload: schemas.PropagateRequest,
) -> int:
    with _lock:
        svc = _sam3_video_cls()

    frames = _frames_in_window(
        session, project_id, payload.start_frame, payload.end_frame
    )
    if not frames:
        return 0

    base_idx = payload.start_frame
    frame_bytes = [Path(f.path).read_bytes() for f in frames]
    w, h = frames[0].width, frames[0].height

    prompts, track_to_class = _build_prompts_from_payload(payload.objects, base_idx)
    if not prompts:
        prompts, track_to_class = _seed_from_existing(session, project_id, payload.start_frame)
    if not prompts:
        return 0  # nothing to track

    results = svc.propagate.remote(
        frames=frame_bytes,
        prompts=prompts,
        width=w,
        height=h,
        start_idx=0,
        max_frames=len(frames),
    )

    frame_id_by_local_idx = {i: f.id for i, f in enumerate(frames)}
    written = 0
    for r in results:
        frame_id = frame_id_by_local_idx.get(r["frame_idx"])
        if frame_id is None:
            continue
        class_id = track_to_class.get(r["obj_id"])
        if class_id is None:
            continue
        bbox = {k: v for k, v in r.items() if k not in ("frame_idx", "obj_id")}
        _write_annotation(
            session,
            project_id,
            frame_id,
            r["obj_id"],
            class_id,
            bbox,
            models.AnnotationSource.propagated,
        )
        written += 1
    session.commit()
    return written


def correct_track(
    session: Session,
    project_id: int,
    track_id: int,
    payload: schemas.CorrectionRequest,
) -> int:
    """Re-prompt a track at a later frame and re-propagate forward.

    Drops downstream propagated annotations for this track, then runs a fresh
    Modal propagation seeded by the corrective prompt.
    """
    with _lock:
        svc = _sam3_video_cls()

    track = session.get(models.Track, track_id)
    if not track:
        return 0
    class_id = track.class_id

    # Find end of propagation window (either user-specified or end of video).
    last_frame = session.exec(
        select(models.Frame)
        .where(models.Frame.project_id == project_id)
        .order_by(models.Frame.idx.desc())
    ).first()
    if not last_frame:
        return 0
    end_frame = payload.propagate_to if payload.propagate_to is not None else last_frame.idx

    # Delete stale downstream propagated annotations for this track.
    downstream = session.exec(
        select(models.Annotation, models.Frame).where(
            models.Annotation.project_id == project_id,
            models.Annotation.track_id == track_id,
            models.Annotation.source == models.AnnotationSource.propagated,
            models.Annotation.frame_id == models.Frame.id,
            models.Frame.idx >= payload.frame_idx,
        )
    ).all()
    for ann, _ in downstream:
        session.delete(ann)
    session.flush()

    frames = _frames_in_window(session, project_id, payload.frame_idx, end_frame)
    if not frames:
        return 0

    frame_bytes = [Path(f.path).read_bytes() for f in frames]
    w, h = frames[0].width, frames[0].height

    prompts = [
        {
            "frame_idx": 0,
            "obj_id": track_id,
            "points": [[p.x, p.y] for p in payload.points] if payload.points else None,
            "labels": [p.label for p in payload.points] if payload.points else None,
            "box": list(payload.box) if payload.box else None,
        }
    ]

    results = svc.propagate.remote(
        frames=frame_bytes,
        prompts=prompts,
        width=w,
        height=h,
        start_idx=0,
        max_frames=len(frames),
    )

    frame_id_by_local_idx = {i: f.id for i, f in enumerate(frames)}
    written = 0
    for r in results:
        if r["obj_id"] != track_id:
            continue
        frame_id = frame_id_by_local_idx.get(r["frame_idx"])
        if frame_id is None:
            continue
        bbox = {k: v for k, v in r.items() if k not in ("frame_idx", "obj_id")}
        _write_annotation(
            session,
            project_id,
            frame_id,
            track_id,
            class_id,
            bbox,
            models.AnnotationSource.propagated,
        )
        written += 1
    session.commit()
    return written
