from __future__ import annotations

from pathlib import Path
from threading import Lock

from sahi import AutoDetectionModel
from sahi.predict import get_sliced_prediction

from ..config import DEVICE, SAHI_OVERLAP, SAHI_SLICE, YOLO_WEIGHTS

_lock = Lock()
_model: AutoDetectionModel | None = None


def get_model() -> AutoDetectionModel:
    global _model
    with _lock:
        if _model is None:
            if not YOLO_WEIGHTS.exists():
                raise FileNotFoundError(
                    f"YOLO weights not found at {YOLO_WEIGHTS}. "
                    "Symlink or copy best_visdrone.pt into app/weights/."
                )
            _model = AutoDetectionModel.from_pretrained(
                model_type="ultralytics",
                model_path=str(YOLO_WEIGHTS),
                confidence_threshold=0.25,
                device=DEVICE,
            )
        return _model


def sliced_predict(image_path: Path):
    model = get_model()
    result = get_sliced_prediction(
        str(image_path),
        model,
        slice_height=SAHI_SLICE,
        slice_width=SAHI_SLICE,
        overlap_height_ratio=SAHI_OVERLAP,
        overlap_width_ratio=SAHI_OVERLAP,
    )
    out = []
    for p in result.object_prediction_list:
        b = p.bbox
        out.append(
            {
                "class_name": p.category.name,
                "class_id": p.category.id,
                "confidence": float(p.score.value),
                "bbox_x1": float(b.minx),
                "bbox_y1": float(b.miny),
                "bbox_x2": float(b.maxx),
                "bbox_y2": float(b.maxy),
            }
        )
    return out
