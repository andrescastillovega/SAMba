"""Thin Modal client for SAM 3 image inference.

The backend previously loaded SAM 3 locally, which doesn't fit on small GPUs.
Now it delegates to the Modal app defined in `app/sam3_modal.py` (deployed
separately with `modal deploy`).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from threading import Lock

from ..config import MODAL_SAM3_APP_NAME

_lock = Lock()


@lru_cache(maxsize=1)
def _sam3_cls():
    import modal

    Cls = modal.Cls.from_name(MODAL_SAM3_APP_NAME, "Sam3Image")
    return Cls()


def predict_from_points(
    image_path: Path,
    points: list[tuple[float, float]],
    labels: list[int],
    box: list[float] | None = None,
) -> tuple[dict | None, float]:
    """Remote SAM 3 click refinement. Returns (bbox_dict, score)."""
    with _lock:
        svc = _sam3_cls()
    img_bytes = Path(image_path).read_bytes()
    pts = [[float(x), float(y)] for (x, y) in points]
    return svc.predict_from_points.remote(
        image_bytes=img_bytes,
        points=pts,
        labels=list(labels),
        box=list(box) if box else None,
    )


def predict_from_text(image_path: Path, prompt: str) -> list[dict]:
    """Remote SAM 3 open-vocabulary text prompt. Returns list of {bbox..., polygon, score}."""
    with _lock:
        svc = _sam3_cls()
    img_bytes = Path(image_path).read_bytes()
    return svc.predict_from_text.remote(image_bytes=img_bytes, prompt=prompt)
