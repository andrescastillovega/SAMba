from __future__ import annotations

import os
from pathlib import Path

import torch

APP_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = APP_DIR.parent
DATA_DIR = APP_DIR / "data"
WEIGHTS_DIR = APP_DIR / "weights"

DB_PATH = DATA_DIR / "db.sqlite3"
PROJECTS_DIR = DATA_DIR / "projects"

YOLO_WEIGHTS = WEIGHTS_DIR / "best_visdrone.pt"

DEVICE = os.environ.get("SAMBA_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")

SAHI_SLICE = int(os.environ.get("SAMBA_SAHI_SLICE", "640"))
SAHI_OVERLAP = float(os.environ.get("SAMBA_SAHI_OVERLAP", "0.2"))

# SAM 3 runs on Modal (local GPU is too small). Deploy with
# `modal deploy app/sam3_modal.py` and the backend calls into it via modal.Cls.
MODAL_SAM3_APP_NAME = os.environ.get("MODAL_SAM3_APP_NAME", "drone-traffic-sam3")

# Video predictor: still runs locally (deferred Modal wiring). Will OOM on
# small GPUs. Set SAM3_GPUS_TO_USE=0 explicitly or leave unset for default.
SAM3_GPUS_TO_USE = os.environ.get("SAM3_GPUS_TO_USE")

for _dir in (DATA_DIR, WEIGHTS_DIR, PROJECTS_DIR):
    _dir.mkdir(parents=True, exist_ok=True)
