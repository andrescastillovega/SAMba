from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import schemas
from .config import DEVICE
from .db import init_db
from .routers import (
    annotations,
    classes,
    export,
    frames,
    preannotate,
    projects,
    sam,
    videos,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.yolo_model = None  # loaded lazily in services.yolo_sahi
    app.state.sam_image_predictor = None
    yield


app = FastAPI(title="SAMba video annotator", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=schemas.HealthResponse)
def health():
    import torch

    return schemas.HealthResponse(
        device=DEVICE,
        cuda=torch.cuda.is_available(),
        yolo_loaded=app.state.yolo_model is not None,
        sam_image_loaded=app.state.sam_image_predictor is not None,
    )


app.include_router(projects.router)
app.include_router(classes.router)
app.include_router(videos.router)
app.include_router(frames.router)
app.include_router(annotations.router)
app.include_router(preannotate.router)
app.include_router(sam.router)
app.include_router(export.router)
