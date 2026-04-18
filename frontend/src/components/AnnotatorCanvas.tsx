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
  const outerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [rendered, setRendered] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;
  const panStateRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const didPanRef = useRef(false);
  const [menu, setMenu] = useState<
    { x: number; y: number; annotationId: number } | null
  >(null);
  const qc = useQueryClient();

  const interactiveMode = useCanvas((s) => s.interactiveMode);
  const pendingPoints = useCanvas((s) => s.pendingPoints);
  const addPoint = useCanvas((s) => s.addPoint);
  const clearPoints = useCanvas((s) => s.clearPoints);
  const previewMask = useCanvas((s) => s.previewMask);
  const setPreviewMask = useCanvas((s) => s.setPreviewMask);
  const activeClassId = useCanvas((s) => s.activeClassId);
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
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (e.shiftKey) {
      const hit = pickAnnotation(visibleAnnotations, toImageCoords(e));
      if (hit) del.mutate(hit.id);
      return;
    }
    setMenu(null);
    if (!interactiveMode) return;
    const { x, y } = toImageCoords(e);
    const label: 0 | 1 = e.ctrlKey || e.metaKey ? 0 : 1;
    const point: SamPoint = { x, y, label };
    addPoint(point);
    runSam.mutate({ points: [...pendingPoints, point] });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const hit = pickAnnotation(visibleAnnotations, toImageCoords(e));
    if (!hit) {
      setMenu(null);
      return;
    }
    const outer = outerRef.current;
    const rect = outer
      ? outer.getBoundingClientRect()
      : (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      annotationId: hit.id,
    });
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

      const label = className(a.class_id);
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

  const resetView = () => {
    const outer = outerRef.current;
    if (!outer || !rendered.w) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    setZoom(1);
    setPan({
      x: (outer.clientWidth - rendered.w) / 2,
      y: (outer.clientHeight - rendered.h) / 2,
    });
  };

  const zoomAt = (cx: number, cy: number, factor: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    const next = Math.max(1, Math.min(10, z * factor));
    if (next === z) return;
    const newPan = {
      x: cx - ((cx - p.x) / z) * next,
      y: cy - ((cy - p.y) / z) * next,
    };
    zoomRef.current = next;
    panRef.current = newPan;
    setZoom(next);
    setPan(newPan);
  };

  const zoomAtCenter = (factor: number) => {
    const outer = outerRef.current;
    const cx = outer ? outer.clientWidth / 2 : 0;
    const cy = outer ? outer.clientHeight / 2 : 0;
    zoomAt(cx, cy, factor);
  };

  useEffect(() => {
    resetView();
  }, [rendered.w, rendered.h, frameIdx]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const panButton = e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey));
    if (!panButton) return;
    if (e.button === 1) e.preventDefault();
    panStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    didPanRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = panStateRef.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) didPanRef.current = true;
    setPan({ x: st.panX + dx, y: st.panY + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!panStateRef.current) return;
    panStateRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may already be released
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === 'Enter' && previewMask && activeClassId != null) {
        commitAnn.mutate();
      } else if (e.key === 'Escape') {
        clearPoints();
        setMenu(null);
      } else if (!inField && (e.key === '+' || e.key === '=')) {
        zoomAtCenter(1.2);
      } else if (!inField && e.key === '-') {
        zoomAtCenter(1 / 1.2);
      } else if (!inField && e.key === '0') {
        resetView();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMask, activeClassId, rendered.w, rendered.h]);

  useEffect(() => {
    setMenu(null);
  }, [frameIdx]);

  const cursor = panStateRef.current ? 'grabbing' : interactiveMode ? 'crosshair' : 'default';

  const panCursor = cursor;

  return (
    <div
      ref={outerRef}
      className="relative h-full w-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
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
          className="block max-h-[calc(100vh-220px)] max-w-[calc(100vw-340px)] select-none"
          style={{ cursor: panCursor }}
        />
        <canvas
          ref={overlayRef}
          onClick={onClick}
          onContextMenu={onContextMenu}
          className="absolute inset-0"
          style={{ cursor: panCursor }}
        />
      </div>
      <div className="pointer-events-auto absolute right-2 top-2 flex items-center gap-0.5 rounded border border-slate-700 bg-slate-900/80 px-1 py-1 text-xs backdrop-blur-sm">
        <button
          onClick={() => zoomAtCenter(1 / 1.2)}
          className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="w-12 text-center font-mono text-slate-300">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => zoomAtCenter(1.2)}
          className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={resetView}
          className="ml-0.5 rounded px-2 py-0.5 text-slate-300 hover:bg-slate-800"
          title="Reset view (0)"
          aria-label="Reset view"
        >
          ⟲
        </button>
      </div>
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
