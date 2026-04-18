# SAMba v2

A web-based video annotator powered by **SAM 3**, SAHI, and a fine-tuned YOLO. Click to label, propagate across frames, export YOLO/COCO/VOC datasets.

v2 is a full rewrite — the v1 FastHTML + SAM 2 prototype lives at tag [`v1.0.0`](../../tree/v1.0.0). The new stack:

| Layer | v1 | v2 |
|---|---|---|
| Frontend | FastHTML | Vite + React + TypeScript + Tailwind |
| Backend | FastHTML | FastAPI + SQLModel |
| Model | SAM 2 (local) | SAM 3 (remote, Modal) + SAHI + YOLO |
| Tracking | none | SAM 3 video predictor (session-based) |
| Output | single image | video → YOLO / COCO / VOC |

## What it does

1. **Upload a video** → frames are extracted into `data/projects/<id>/frames/`.
2. **Pre-annotate (YOLO)** any frame with SAHI-tiled inference using a fine-tuned `.pt` — fast auto-boxes. Runs on your local GPU.
3. **Detect by text (SAM 3)** — type `"cars"` and SAM 3 segments every instance on the current frame. Sent to Modal.
4. **Refine with SAM 3 clicks** — left-click fg, Ctrl+click bg, Enter to commit. Sent to Modal.
5. **Propagate** — track every box on the current frame forward N frames under stable track IDs. SAM 3 video predictor runs on Modal.
6. **Fix drift** on any later frame: select the track, enable correction mode, click to reseed.
7. **Export** YOLO, COCO, or Pascal VOC as a zipped dataset.

Dedup: any new box (from YOLO, SAM text, or SAM click) with ≥80% IoU against an existing box is silently skipped. Hidden-class toggles in the sidebar control which boxes render on the canvas.

## Prerequisites

- **Python 3.12+** (`.python-version`)
- **uv** (<https://docs.astral.sh/uv/>)
- **Node.js 20+** and npm
- A CUDA-capable GPU (any size — SAM 3 runs on Modal; only YOLO/SAHI uses local CUDA)
- **HuggingFace account** with access to the gated `facebook/sam3` model — request at <https://huggingface.co/facebook/sam3>
- **Modal account** (free tier works) — <https://modal.com/signup>

## Install

```bash
uv sync                                   # backend deps
cd frontend && npm install && cd ..       # frontend deps
```

Drop a fine-tuned YOLO checkpoint at `weights/best_visdrone.pt` (a symlink is fine — `.pt` files are gitignored).

## Deploy the SAM 3 Modal service

One-time setup — creates a persistent Modal app the backend calls into.

```bash
# 1. authenticate Modal
uv run modal token new

# 2. register your HF token as a Modal secret
uv run modal secret create huggingface HUGGING_FACE_HUB_TOKEN=hf_xxxxx

# 3. deploy (defaults to A10G)
uv run modal deploy sam3_modal.py
```

The deploy publishes an app named `drone-traffic-sam3` with classes `Sam3Image` (clicks + text) and `Sam3Video` (propagate). Cold start ~30–60 s; warm calls ~0.5–1 s.

Smoke test:
```bash
uv run modal run sam3_modal.py::smoke
```

## Run

```bash
# terminal 1 — backend
uv run uvicorn backend.main:app --reload --port 8000 \
    --reload-exclude ".venv/*" --reload-exclude "data/*"

# terminal 2 — frontend
cd frontend && npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` → `:8000`.

## Layout

```
samba/
├── sam3_modal.py              # Modal app — Sam3Image + Sam3Video classes
├── backend/
│   ├── main.py, config.py, db.py, models.py, schemas.py
│   ├── routers/
│   │   ├── projects.py, videos.py, frames.py, classes.py
│   │   ├── annotations.py, export.py
│   │   ├── preannotate.py    # SAHI + local YOLO
│   │   ├── sam.py            # sam_click + text_detect → Modal Sam3Image
│   │   └── tracks.py         # propagate + correct → Modal Sam3Video
│   └── services/
│       ├── ffmpeg.py, yolo_sahi.py, exporters.py
│       ├── dedup.py          # IoU-based 0.8 threshold
│       ├── sam_image.py      # Modal client (Sam3Image)
│       └── sam_video.py      # Modal client (Sam3Video)
├── frontend/                 # Vite + React + Tailwind v4
├── data/                     # gitignored — sqlite, frames, videos
└── weights/                  # gitignored — *.pt
```

## Hotkeys

- **Left-click**: SAM foreground point (Point tool)
- **Ctrl + left-click**: SAM background point
- **Enter**: commit the current SAM mask as an annotation
- **Escape**: clear pending SAM points / close context menu
- **Shift + left-click on a bbox**: delete that annotation
- **Click on a bbox** (Select Annotation tool): open a menu to relabel or delete

## Env vars

- `SAMBA_DEVICE` — YOLO device (`cuda` or `cpu`). Defaults to CUDA when available.
- `MODAL_SAM3_APP_NAME` — Modal app name, defaults to `drone-traffic-sam3`.
- `SAMBA_SAHI_SLICE` / `SAMBA_SAHI_OVERLAP` — SAHI tile size / overlap.

## Known limitations

- Single-user, no auth — local dev tool.
- Propagation is blocking; no SSE progress stream yet.
- The Modal container caches the SAM 3 checkpoint but has a 5 min idle timeout — first call after idle hits a cold start.
