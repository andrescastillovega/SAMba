import { useCanvas } from '../state/canvasStore';
import type { Frame } from '../api/client';

export default function FrameTimeline({
  projectId,
  frames,
}: {
  projectId: number;
  frames: Frame[];
}) {
  const frameIdx = useCanvas((s) => s.frameIdx);
  const setFrameIdx = useCanvas((s) => s.setFrameIdx);

  return (
    <div className="border-t border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">
        <span>Frame {frameIdx + 1} / {frames.length}</span>
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={frameIdx}
          onChange={(e) => setFrameIdx(Number(e.target.value))}
          className="flex-1 accent-sky-500"
        />
        <button
          onClick={() => setFrameIdx(Math.max(frameIdx - 1, 0))}
          className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700"
        >
          ←
        </button>
        <button
          onClick={() => setFrameIdx(Math.min(frameIdx + 1, frames.length - 1))}
          className="rounded bg-slate-800 px-2 py-1 hover:bg-slate-700"
        >
          →
        </button>
      </div>
      <div className="flex h-14 items-stretch overflow-x-auto border-t border-slate-800">
        {frames.map((f) => (
          <button
            key={f.id}
            onClick={() => setFrameIdx(f.idx)}
            className={`h-full w-14 shrink-0 border-r border-slate-800 bg-cover bg-center ${
              f.idx === frameIdx ? 'ring-2 ring-inset ring-sky-500' : 'opacity-70 hover:opacity-100'
            }`}
            style={{
              backgroundImage: `url(/api/projects/${projectId}/frames/${f.idx}/image)`,
            }}
            title={`Frame ${f.idx}`}
          />
        ))}
      </div>
    </div>
  );
}
