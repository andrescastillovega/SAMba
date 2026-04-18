"""Modal-hosted SAM 3 image inference.

Deploy with:

    modal token new                 # one-time local auth
    modal secret create huggingface HUGGING_FACE_HUB_TOKEN=hf_xxx  # SAM 3 is gated
    modal deploy app/sam3_modal.py

The FastAPI backend reaches it via `modal.Cls.from_name("drone-traffic-sam3", "<Class>")`.

Classes exposed:

- Sam3Image
  - predict_from_points(image_bytes, points, labels, box?) -> (bbox_dict|None, score)
  - predict_from_text(image_bytes, prompt) -> list[bbox_dict with "score"]

- Sam3Video
  - propagate(frames_bytes, prompts, width, height, start_idx=0, max_frames=None)
    -> list[{frame_idx, obj_id, bbox+polygon}]
    prompts: list of {frame_idx, obj_id, text?, points?, labels?, box?} in ABSOLUTE
    pixel coords. The method normalizes to (0,1) xywh internally for SAM 3 video.
"""
from __future__ import annotations

import io
from typing import Any

import modal

APP_NAME = "drone-traffic-sam3"

app = modal.App(APP_NAME)

HF_SECRET = modal.Secret.from_name("huggingface")
HF_CACHE_DIR = "/root/.cache/huggingface"


def _prefetch_sam3_weights() -> None:
    """Bake SAM 3 checkpoint + config into the image so cold starts skip the HF download."""
    from huggingface_hub import hf_hub_download

    hf_hub_download(repo_id="facebook/sam3", filename="config.json")
    hf_hub_download(repo_id="facebook/sam3", filename="sam3.pt")


image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libgl1", "libglib2.0-0", "git")
    .pip_install(
        "torch>=2.7",
        "numpy>=1.26,<2",
        "pillow",
        "opencv-python-headless",
        "huggingface-hub>=0.26",
        "einops>=0.8",
        "pycocotools>=2.0.8",
        "scipy",
        "scikit-image",
        "psutil",
        "hydra-core",
        "submitit",
        "torchmetrics",
        "fvcore",
        "fairscale",
        "pandas",
        "python-rapidjson",
        "zstandard",
    )
    .pip_install("sam3 @ git+https://github.com/facebookresearch/sam3.git")
    .env({"HF_HOME": HF_CACHE_DIR, "HF_HUB_ENABLE_HF_TRANSFER": "0"})
    .run_function(_prefetch_sam3_weights, secrets=[HF_SECRET])
)


def _mask_to_bbox(mask) -> dict[str, Any] | None:
    import cv2

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(contour)
    if w <= 0 or h <= 0:
        return None
    (cx, cy), (rw, rh), theta = cv2.minAreaRect(contour)
    polygon = contour.reshape(-1, 2).astype(float).tolist()
    return {
        "bbox_x1": float(x),
        "bbox_y1": float(y),
        "bbox_x2": float(x + w),
        "bbox_y2": float(y + h),
        "rbbox_cx": float(cx),
        "rbbox_cy": float(cy),
        "rbbox_w": float(rw),
        "rbbox_h": float(rh),
        "rbbox_theta": float(theta),
        "polygon": polygon,
    }


@app.cls(
    gpu="A10G",
    image=image,
    secrets=[HF_SECRET],
    timeout=900,
    scaledown_window=300,
    max_containers=1,
)
class Sam3Image:
    @modal.enter()
    def load(self):
        from sam3.model_builder import build_sam3_image_model
        from sam3.model.sam3_image_processor import Sam3Processor

        self.model = build_sam3_image_model(
            device="cuda",
            enable_inst_interactivity=True,
            load_from_HF=True,
        )
        self.processor = Sam3Processor(self.model, device="cuda")

    def _encode(self, image_bytes: bytes):
        from PIL import Image

        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        state = self.processor.set_image(pil)
        return state

    @modal.method()
    def predict_from_points(
        self,
        image_bytes: bytes,
        points: list[list[float]],
        labels: list[int],
        box: list[float] | None = None,
    ) -> tuple[dict | None, float]:
        import numpy as np

        state = self._encode(image_bytes)
        pc = np.array(points, dtype=np.float32) if points else None
        pl = np.array(labels, dtype=np.int32) if labels else None
        bx = np.array(box, dtype=np.float32) if box else None
        masks, scores, _ = self.model.predict_inst(
            state,
            point_coords=pc,
            point_labels=pl,
            box=bx,
            multimask_output=True,
        )

        def _np(t):
            if hasattr(t, "detach"):
                return t.detach().float().cpu().numpy()
            return np.asarray(t)

        masks = _np(masks)
        scores = _np(scores)
        best = int(np.argmax(scores))
        mask = (masks[best] > 0.5).astype(np.uint8)
        bbox = _mask_to_bbox(mask)
        return bbox, float(scores[best])

    @modal.method()
    def predict_from_text(
        self, image_bytes: bytes, prompt: str
    ) -> list[dict]:
        import numpy as np

        state = self._encode(image_bytes)
        output = self.processor.set_text_prompt(prompt=prompt, state=state)
        masks = output.get("masks")
        scores = output.get("scores")
        if masks is None:
            return []
        def _to_np(t):
            if t is None:
                return None
            if hasattr(t, "detach"):
                return t.detach().float().cpu().numpy()
            return np.asarray(t)

        masks_np = _to_np(masks)
        scores_np = _to_np(scores)
        results: list[dict] = []
        for i in range(masks_np.shape[0]):
            m = masks_np[i]
            if m.ndim == 3:
                m = m[0]
            m_u8 = (m > 0).astype(np.uint8)
            bbox = _mask_to_bbox(m_u8)
            if bbox is None:
                continue
            bbox["score"] = float(scores_np[i]) if scores_np is not None else 1.0
            results.append(bbox)
        return results


def _iter_obj_masks(outputs):
    """Flatten SAM 3 video `response["outputs"]` into (obj_id, mask, score?) triples.

    The post-processed output dict has `out_obj_ids` (int64 tensor), `out_binary_masks`
    (bool tensor, shape N×H×W), and `out_probs` (float tensor, per-object score).
    """
    import numpy as np

    if not isinstance(outputs, dict):
        return
    obj_ids = outputs.get("out_obj_ids")
    masks = outputs.get("out_binary_masks")
    probs = outputs.get("out_probs")
    if obj_ids is None or masks is None:
        return
    obj_ids_list = (
        obj_ids.tolist() if hasattr(obj_ids, "tolist") else list(obj_ids)
    )
    masks_np = (
        masks.detach().cpu().numpy() if hasattr(masks, "detach") else np.asarray(masks)
    )
    probs_np = None
    if probs is not None:
        probs_np = (
            probs.detach().float().cpu().numpy()
            if hasattr(probs, "detach")
            else np.asarray(probs)
        )
    for i, obj_id in enumerate(obj_ids_list):
        score = float(probs_np[i]) if probs_np is not None and i < len(probs_np) else None
        yield int(obj_id), masks_np[i], score


def _mask_to_bbox_dyn(mask):
    """Mask → bbox dict, accepts torch tensors or numpy arrays of any dtype."""
    import cv2
    import numpy as np

    if hasattr(mask, "detach"):
        mask = mask.detach().float().cpu().numpy()
    else:
        mask = np.asarray(mask)
    if mask.ndim == 3:
        mask = mask[0]
    m_u8 = (mask > 0).astype(np.uint8)
    return _mask_to_bbox(m_u8)


@app.cls(
    gpu="A10G",
    image=image,
    secrets=[HF_SECRET],
    timeout=1800,
    scaledown_window=300,
    max_containers=1,
)
class Sam3Video:
    @modal.enter()
    def load(self):
        from sam3.model_builder import build_sam3_video_predictor

        # gpus_to_use=None → single local GPU, no worker-process spawn.
        self.predictor = build_sam3_video_predictor(gpus_to_use=None)

    @modal.method()
    def propagate(
        self,
        frames: list[bytes],
        prompts: list[dict],
        width: int,
        height: int,
        start_idx: int = 0,
        max_frames: int | None = None,
    ) -> list[dict]:
        import tempfile

        import torch

        results: list[dict] = []

        with tempfile.TemporaryDirectory() as tmpdir:
            for idx, data in enumerate(frames):
                with open(f"{tmpdir}/frame_{idx:06d}.jpg", "wb") as f:
                    f.write(data)

            response = self.predictor.handle_request(
                request=dict(type="start_session", resource_path=tmpdir)
            )
            session_id = response["session_id"]

            try:
                for p in prompts:
                    req: dict[str, Any] = dict(
                        type="add_prompt",
                        session_id=session_id,
                        frame_index=int(p["frame_idx"]),
                        obj_id=int(p["obj_id"]),
                    )
                    if p.get("text"):
                        req["text"] = p["text"]
                    if p.get("points"):
                        pts = torch.tensor(
                            [[x / width, y / height] for (x, y) in p["points"]],
                            dtype=torch.float32,
                        )
                        lbls = p.get("labels") or [1] * len(p["points"])
                        req["points"] = pts
                        req["point_labels"] = torch.tensor(lbls, dtype=torch.int32)
                    if p.get("box"):
                        x1, y1, x2, y2 = p["box"]
                        xywh = [
                            [x1 / width, y1 / height, (x2 - x1) / width, (y2 - y1) / height]
                        ]
                        req["bounding_boxes"] = torch.tensor(xywh, dtype=torch.float32)
                        req["bounding_box_labels"] = torch.tensor([1], dtype=torch.int32)
                    self.predictor.handle_request(request=req)

                stream_req: dict[str, Any] = dict(
                    type="propagate_in_video",
                    session_id=session_id,
                    start_frame_index=start_idx,
                )
                if max_frames is not None:
                    stream_req["max_frame_num_to_track"] = max_frames

                for response in self.predictor.handle_stream_request(request=stream_req):
                    frame_idx = response["frame_index"]
                    outputs = response.get("outputs")
                    for obj_id, mask, score in _iter_obj_masks(outputs):
                        bbox = _mask_to_bbox_dyn(mask)
                        if bbox is None:
                            continue
                        entry = {
                            "frame_idx": int(frame_idx),
                            "obj_id": int(obj_id),
                            **bbox,
                        }
                        if score is not None:
                            entry["score"] = score
                        results.append(entry)
            finally:
                try:
                    self.predictor.handle_request(
                        request=dict(type="close_session", session_id=session_id)
                    )
                except Exception:
                    pass

        return results


@app.local_entrypoint()
def smoke():
    """Quick round-trip test: deploy, then `modal run app/sam3_modal.py::smoke`."""
    import pathlib

    sample = pathlib.Path(__file__).resolve().parent.parent / "bus.jpg"
    if not sample.exists():
        print(f"no sample image at {sample}")
        return
    svc = Sam3Image()
    dets = svc.predict_from_text.remote(sample.read_bytes(), "bus")
    print(f"text_detect returned {len(dets)} instances")
    if dets:
        print({k: v for k, v in dets[0].items() if k != "polygon"})


@app.local_entrypoint()
def smoke_video():
    """End-to-end test for Sam3Video: take 3 frames from ./frames, text-prompt 'car', propagate."""
    import pathlib

    frames_dir = pathlib.Path(__file__).resolve().parent.parent / "frames"
    paths = sorted(
        p for p in frames_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )[:3]
    if not paths:
        print(f"no frames found at {frames_dir}")
        return
    from PIL import Image as PILImage

    w, h = PILImage.open(paths[0]).size
    print(f"loaded {len(paths)} frames @ {w}x{h}")

    svc = Sam3Video()
    results = svc.propagate.remote(
        frames=[p.read_bytes() for p in paths],
        prompts=[{"frame_idx": 0, "obj_id": 1, "text": "car"}],
        width=w,
        height=h,
        start_idx=0,
        max_frames=len(paths),
    )
    print(f"propagate returned {len(results)} (frame, obj) results")
    for r in results[:5]:
        print(
            {k: v for k, v in r.items() if k != "polygon"}
        )
