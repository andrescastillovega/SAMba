import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, preannotateFrame, type Annotation } from '../api/client';
import { useCanvas } from '../state/canvasStore';
import { useToasts } from '../state/toastStore';

export default function ActionBar({ projectId, frameIdx }: { projectId: number; frameIdx: number }) {
  const qc = useQueryClient();
  const interactiveMode = useCanvas((s) => s.interactiveMode);
  const setInteractiveMode = useCanvas((s) => s.setInteractiveMode);
  const pushToast = useToasts((s) => s.push);
  const [propN, setPropN] = useState(30);
  const [textPrompt, setTextPrompt] = useState('');

  const preannotate = useMutation({
    mutationFn: () => preannotateFrame(projectId, frameIdx),
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
      const n = added?.length ?? 0;
      pushToast(
        n === 0 ? 'YOLO: no new boxes (all overlapped).' : `YOLO: added ${n} box${n === 1 ? '' : 'es'}.`,
        n === 0 ? 'warning' : 'success',
      );
    },
  });

  const textDetect = useMutation({
    mutationKey: ['sam'],
    mutationFn: async () => {
      return api
        .post(`projects/${projectId}/frames/${frameIdx}/text_detect`, {
          json: { prompt: textPrompt },
          timeout: 10 * 60 * 1000,
        })
        .json<Annotation[]>();
    },
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
      const n = added?.length ?? 0;
      pushToast(
        n === 0
          ? `SAM 3 "${textPrompt}": no new boxes (all overlapped existing).`
          : `SAM 3 "${textPrompt}": added ${n} box${n === 1 ? '' : 'es'}.`,
        n === 0 ? 'warning' : 'success',
      );
    },
  });

  const propagate = useMutation({
    mutationKey: ['sam'],
    mutationFn: async () => {
      const end = frameIdx + propN;
      return api
        .post(`projects/${projectId}/tracks/propagate`, {
          json: { start_frame: frameIdx, end_frame: end, objects: [] },
          timeout: 30 * 60 * 1000,
        })
        .json<{ written: number }>();
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId] });
      qc.invalidateQueries({ queryKey: ['tracks', projectId] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
      const n = res?.written ?? 0;
      pushToast(
        n === 0
          ? 'Propagate: no boxes on this frame to track. Add or pre-annotate boxes first.'
          : `Propagate: wrote ${n} annotation${n === 1 ? '' : 's'} across frames.`,
        n === 0 ? 'warning' : 'success',
      );
    },
  });

  const exportUrl = (fmt: string) => `/api/projects/${projectId}/export?format=${fmt}`;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-sm">
      <button
        onClick={() => setInteractiveMode(!interactiveMode)}
        aria-pressed={interactiveMode}
        className={`rounded px-3 py-1 text-xs font-medium ring-1 ring-slate-700 ${
          interactiveMode
            ? 'bg-sky-600 text-white ring-sky-500 shadow-inner'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
        title="Toggle SAM point inference on left-click"
      >
        Interactive selection
      </button>

      <button
        onClick={() => preannotate.mutate()}
        disabled={preannotate.isPending}
        className="rounded bg-amber-600 px-3 py-1 font-medium hover:bg-amber-500 disabled:opacity-50"
        title="SAHI-tiled inference with best_visdrone.pt"
      >
        {preannotate.isPending ? 'Pre-annotating…' : 'Pre-annotate (YOLO)'}
      </button>

      <form
        className="flex items-center gap-1 text-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (textPrompt.trim()) textDetect.mutate();
        }}
      >
        <input
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          placeholder='SAM 3 text prompt ("cars")'
          className="w-48 rounded bg-slate-800 px-2 py-1"
        />
        <button
          type="submit"
          disabled={!textPrompt.trim() || textDetect.isPending}
          className="rounded bg-violet-600 px-3 py-1 font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          {textDetect.isPending ? 'Detecting…' : 'Detect (SAM 3 text)'}
        </button>
      </form>

      <div className="flex items-center gap-1 text-xs">
        <label>Propagate +</label>
        <input
          type="number"
          min={1}
          value={propN}
          onChange={(e) => setPropN(Number(e.target.value) || 1)}
          className="w-16 rounded bg-slate-800 px-2 py-1"
        />
        <button
          onClick={() => propagate.mutate()}
          disabled={propagate.isPending}
          className="rounded bg-emerald-600 px-3 py-1 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {propagate.isPending ? 'Propagating…' : 'Propagate'}
        </button>
      </div>

      <div className="ml-auto flex gap-1">
        {['yolo', 'coco', 'voc'].map((fmt) => (
          <a
            key={fmt}
            href={exportUrl(fmt)}
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
          >
            Export {fmt.toUpperCase()}
          </a>
        ))}
      </div>
    </div>
  );
}
