from __future__ import annotations

from pathlib import Path

import cv2


def probe_video(path: Path) -> dict:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return {}
    fps = cap.get(cv2.CAP_PROP_FPS) or None
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0) or None
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0) or None
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) or None
    cap.release()
    return {"fps": fps, "width": width, "height": height, "count": count}


def extract_frames(
    video_path: Path,
    out_dir: Path,
    stride: int = 1,
) -> list[tuple[int, Path, tuple[int, int]]]:
    """Extract frames from a video. Returns list of (idx, path, (w, h))."""
    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video: {video_path}")

    results: list[tuple[int, Path, tuple[int, int]]] = []
    raw_idx = 0
    out_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if raw_idx % stride == 0:
            path = out_dir / f"frame_{out_idx:06d}.jpg"
            cv2.imwrite(str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
            h, w = frame.shape[:2]
            results.append((out_idx, path, (w, h)))
            out_idx += 1
        raw_idx += 1
    cap.release()
    return results
