import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  deleteAnnotation,
  frameImageUrl,
  listAnnotations,
  listClasses,
  samClick,
  updateAnnotation,
  type Annotation,
  type Klass,
  type SamPoint,
} from '../api/client';
import { useCanvas } from '../state/canvasStore';

export default function AnnotatorCanvas({
  projectId,
  frameIdx,
}: {
  projectId: number;
  frameIdx: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [rendered, setRendered] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<
    { x: number; y: number; annotationId: number } | null
  >(null);
  const qc = useQueryClient();

  const tool = useCanvas((s) => s.tool);
  const pendingPoints = useCanvas((s) => s.pendingPoints);
  const addPoint = useCanvas((s) => s.addPoint);
  const clearPoints = useCanvas((s) => s.clearPoints);
  const previewMask = useCanvas((s) => s.previewMask);
  const setPreviewMask = useCanvas((s) => s.setPreviewMask);
  const activeClassId = useCanvas((s) => s.activeClassId);
  const selectedTrackId = useCanvas((s) => s.selectedTrackId);
  const correctionMode = useCanvas((s) => s.correctionMode);
  const setCorrectionMode = useCanvas((s) => s.setCorrectionMode);
  const hiddenClassIds = useCanvas((s) => s.hiddenClassIds);

  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations', projectId, frameIdx],
    queryFn: () => listAnnotations(projectId, frameIdx),
  });
  const visibleAnnotations = annotations.filter(
    (a) => !hiddenClassIds.includes(a.class_id),
  );
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', projectId],
    queryFn: () => listClasses(projectId),
  });
  const classColor = (id: number) => classes.find((c: Klass) => c.id === id)?.color ?? '#38bdf8';
  const className = (id: number) => classes.find((c: Klass) => c.id === id)?.name ?? `#${id}`;

  const runSam = useMutation({
    mutationKey: ['sam'],
    mutationFn: ({
      points,
      box,
    }: {
      points: SamPoint[];
      box?: [number, number, number, number] | null;
    }) => samClick(projectId, frameIdx, points, box),
    onSuccess: (res) => setPreviewMask(res.mask_polygon),
  });

  const commitAnn = useMutation({
    mutationKey: ['sam'],
    mutationFn: async () => {
      if (!previewMask || !runSam.data || activeClassId == null) return null;
      const r = runSam.data;
      const res = await api
        .post(`projects/${projectId}/annotations`, {
          json: {
            frame_id: await getFrameId(projectId, frameIdx),
            class_id: activeClassId,
            bbox_x1: r.bbox_x1,
            bbox_y1: r.bbox_y1,
            bbox_x2: r.bbox_x2,
            bbox_y2: r.bbox_y2,
            rbbox_cx: r.rbbox_cx,
            rbbox_cy: r.rbbox_cy,
            rbbox_w: r.rbbox_w,
            rbbox_h: r.rbbox_h,
            rbbox_theta: r.rbbox_theta,
            polygon_json: JSON.stringify(r.mask_polygon),
            source: 'manual',
          },
        })
        .json<Annotation>();
      return res;
    },
    onSuccess: () => {
      clearPoints();
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
    },
  });

  const correct = useMutation({
    mutationKey: ['sam'],
    mutationFn: async (points: SamPoint[]) => {
      if (selectedTrackId == null) return;
      await api.post(`projects/${projectId}/tracks/${selectedTrackId}/correct`, {
        json: { frame_idx: frameIdx, points },
      });
    },
    onSuccess: () => {
      setCorrectionMode(false);
      qc.invalidateQueries({ queryKey: ['annotations', projectId] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteAnnotation(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
    },
  });

  const reclass = useMutation({
    mutationFn: ({ id, classId }: { id: number; classId: number }) =>
      updateAnnotation(projectId, id, { class_id: classId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
    },
  });

  const toImageCoords = (e: React.MouseEvent) => {
    const img = imgRef.current;
    if (!img || !imgSize.w) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      const hit = pickAnnotation(visibleAnnotations, toImageCoords(e));
      if (hit) del.mutate(hit.id);
      return;
    }
    if (tool === 'select') {
      const hit = pickAnnotation(visibleAnnotations, toImageCoords(e));
      if (hit) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMenu({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          annotationId: hit.id,
        });
      } else {
        setMenu(null);
      }
      return;
    }
    if (tool !== 'point') return;
    const { x, y } = toImageCoords(e);
    const label: 0 | 1 = e.ctrlKey || e.metaKey ? 0 : 1;
    const point: SamPoint = { x, y, label };
    if (correctionMode && selectedTrackId != null) {
      correct.mutate([point]);
      return;
    }
    addPoint(point);
    runSam.mutate({ points: [...pendingPoints, point] });
  };


  useEffect(() => {
    const canvas = overlayRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !rendered.w) return;
    canvas.width = rendered.w;
    canvas.height = rendered.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = rendered.w / (imgSize.w || 1);
    const sy = rendered.h / (imgSize.h || 1);

    for (const a of visibleAnnotations) {
      const color = classColor(a.class_id);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '22';
      const x = a.bbox_x1 * sx;
      const y = a.bbox_y1 * sy;
      const w = (a.bbox_x2 - a.bbox_x1) * sx;
      const h = (a.bbox_y2 - a.bbox_y1) * sy;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);

      const label = a.track_id != null
        ? `${className(a.class_id)} #${a.track_id}`
        : className(a.class_id);
      ctx.font = '11px sans-serif';
      const padX = 3;
      const padY = 2;
      const textW = ctx.measureText(label).width;
      const textH = 12;
      const labelY = y - textH - padY >= 0 ? y - textH - padY : y;
      ctx.fillStyle = color;
      ctx.fillRect(x, labelY, textW + padX * 2, textH + padY * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(label, x + padX, labelY + textH);
    }

    if (previewMask && previewMask.length > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56,189,248,0.25)';
      ctx.beginPath();
      previewMask.forEach(([px, py]: number[], i: number) => {
        const X = px * sx;
        const Y = py * sy;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    for (const p of pendingPoints) {
      ctx.fillStyle = p.label === 1 ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(p.x * sx, p.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }

  }, [visibleAnnotations, previewMask, pendingPoints, rendered, imgSize, classes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && previewMask && activeClassId != null) {
        commitAnn.mutate();
      } else if (e.key === 'Escape') {
        clearPoints();
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMask, activeClassId]);

  useEffect(() => {
    setMenu(null);
  }, [tool, frameIdx]);

  const cursor = tool === 'point' ? 'crosshair' : tool === 'select' ? 'pointer' : 'default';

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative" style={{ maxWidth: '100%', maxHeight: '100%' }}>
        <img
          ref={imgRef}
          src={frameImageUrl(projectId, frameIdx)}
          alt={`frame ${frameIdx}`}
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setImgSize({ w: el.naturalWidth, h: el.naturalHeight });
            setRendered({ w: el.clientWidth, h: el.clientHeight });
          }}
          className="max-h-[calc(100vh-220px)] max-w-[calc(100vw-340px)] select-none"
          style={{ cursor }}
        />
        <canvas
          ref={overlayRef}
          onClick={onClick}
          className="absolute inset-0"
          style={{ cursor }}
        />
        {previewMask && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm shadow-lg">
              {activeClassId == null ? (
                <>
                  <span className="text-amber-400">Select a class on the left to commit</span>
                  <button
                    onClick={() => clearPoints()}
                    className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                  >
                    Discard (Esc)
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-300">
                    Commit as{' '}
                    <span
                      className="inline-flex items-center gap-1 font-medium"
                      style={{ color: classColor(activeClassId) }}
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: classColor(activeClassId) }}
                      />
                      {className(activeClassId)}
                    </span>
                  </span>
                  <button
                    onClick={() => commitAnn.mutate()}
                    disabled={commitAnn.isPending}
                    className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Commit (Enter)
                  </button>
                  <button
                    onClick={() => clearPoints()}
                    className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                  >
                    Discard (Esc)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {menu && (
          <div
            className="absolute z-10 min-w-[180px] overflow-hidden rounded border border-slate-700 bg-slate-900 shadow-lg"
            style={{ left: menu.x + 4, top: menu.y + 4 }}
            onMouseLeave={() => setMenu(null)}
          >
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">
              Change label to
            </div>
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  reclass.mutate({ id: menu.annotationId, classId: c.id });
                  setMenu(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm hover:bg-slate-800"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </button>
            ))}
            <div className="border-t border-slate-700" />
            <button
              onClick={() => {
                del.mutate(menu.annotationId);
                setMenu(null);
              }}
              className="w-full px-3 py-1 text-left text-sm text-rose-400 hover:bg-slate-800"
            >
              Delete box
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

async function getFrameId(projectId: number, idx: number): Promise<number> {
  const frames = await api.get(`projects/${projectId}/frames`).json<{ id: number; idx: number }[]>();
  return frames.find((f) => f.idx === idx)!.id;
}

function pickAnnotation(
  anns: Annotation[],
  pt: { x: number; y: number },
): Annotation | null {
  for (let i = anns.length - 1; i >= 0; i--) {
    const a = anns[i];
    if (pt.x >= a.bbox_x1 && pt.x <= a.bbox_x2 && pt.y >= a.bbox_y1 && pt.y <= a.bbox_y2) {
      return a;
    }
  }
  return null;
}
