from __future__ import annotations

import io
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from sqlmodel import Session, select

from .. import models
from ..paths import frame_abspath


def _load(session: Session, project_id: int):
    project = session.get(models.Project, project_id)
    frames = session.exec(
        select(models.Frame)
        .where(models.Frame.project_id == project_id)
        .order_by(models.Frame.idx)
    ).all()
    classes = session.exec(
        select(models.Class).where(models.Class.project_id == project_id).order_by(models.Class.id)
    ).all()
    annotations = session.exec(
        select(models.Annotation).where(models.Annotation.project_id == project_id)
    ).all()
    class_index = {c.id: i for i, c in enumerate(classes)}
    return project, frames, classes, annotations, class_index


def export_yolo(session: Session, project_id: int) -> bytes:
    project, frames, classes, anns, class_index = _load(session, project_id)
    frame_by_id = {f.id: f for f in frames}

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "classes.txt",
            "\n".join(c.name for c in classes),
        )
        zf.writestr(
            "data.yaml",
            f"path: .\ntrain: images\nval: images\nnc: {len(classes)}\nnames: {[c.name for c in classes]}\n",
        )
        for frame in frames:
            lines: list[str] = []
            for a in anns:
                if a.frame_id != frame.id:
                    continue
                cx = (a.bbox_x1 + a.bbox_x2) / 2 / frame.width
                cy = (a.bbox_y1 + a.bbox_y2) / 2 / frame.height
                w = (a.bbox_x2 - a.bbox_x1) / frame.width
                h = (a.bbox_y2 - a.bbox_y1) / frame.height
                lines.append(
                    f"{class_index[a.class_id]} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
                )
            stem = Path(frame.path).stem
            zf.writestr(f"labels/{stem}.txt", "\n".join(lines))
            try:
                zf.write(frame_abspath(frame), f"images/{Path(frame.path).name}")
            except OSError:
                pass
    return buf.getvalue()


def export_coco(session: Session, project_id: int) -> bytes:
    project, frames, classes, anns, class_index = _load(session, project_id)

    coco = {
        "images": [
            {
                "id": f.id,
                "file_name": Path(f.path).name,
                "width": f.width,
                "height": f.height,
            }
            for f in frames
        ],
        "categories": [
            {"id": class_index[c.id] + 1, "name": c.name} for c in classes
        ],
        "annotations": [],
    }
    for i, a in enumerate(anns, start=1):
        w = a.bbox_x2 - a.bbox_x1
        h = a.bbox_y2 - a.bbox_y1
        coco["annotations"].append(
            {
                "id": i,
                "image_id": a.frame_id,
                "category_id": class_index[a.class_id] + 1,
                "bbox": [a.bbox_x1, a.bbox_y1, w, h],
                "area": w * h,
                "iscrowd": 0,
            }
        )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("annotations.json", json.dumps(coco, indent=2))
        for f in frames:
            try:
                zf.write(frame_abspath(f), f"images/{Path(f.path).name}")
            except OSError:
                pass
    return buf.getvalue()


def export_voc(session: Session, project_id: int) -> bytes:
    project, frames, classes, anns, _ = _load(session, project_id)
    class_by_id = {c.id: c for c in classes}

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for frame in frames:
            root = ET.Element("annotation")
            ET.SubElement(root, "filename").text = Path(frame.path).name
            size = ET.SubElement(root, "size")
            ET.SubElement(size, "width").text = str(frame.width)
            ET.SubElement(size, "height").text = str(frame.height)
            ET.SubElement(size, "depth").text = "3"
            for a in anns:
                if a.frame_id != frame.id:
                    continue
                obj = ET.SubElement(root, "object")
                ET.SubElement(obj, "name").text = class_by_id[a.class_id].name
                bbox = ET.SubElement(obj, "bndbox")
                ET.SubElement(bbox, "xmin").text = str(int(a.bbox_x1))
                ET.SubElement(bbox, "ymin").text = str(int(a.bbox_y1))
                ET.SubElement(bbox, "xmax").text = str(int(a.bbox_x2))
                ET.SubElement(bbox, "ymax").text = str(int(a.bbox_y2))
            xml = ET.tostring(root, encoding="unicode")
            zf.writestr(f"Annotations/{Path(frame.path).stem}.xml", xml)
            try:
                zf.write(frame_abspath(frame), f"JPEGImages/{Path(frame.path).name}")
            except OSError:
                pass
    return buf.getvalue()
