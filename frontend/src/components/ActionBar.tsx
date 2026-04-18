import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, preannotateFrame, refineToRotated, type Annotation } from '../api/client';
import { useCanvas } from '../state/canvasStore';
import { useToasts } from '../state/toastStore';
import Icon from './Icon';

export default function ActionBar({ projectId, frameIdx }: { projectId: number; frameIdx: number }) {
  const qc = useQueryClient();
  const interactiveMode = useCanvas((s) => s.interactiveMode);
  const setInteractiveMode = useCanvas((s) => s.setInteractiveMode);
  const pushToast = useToasts((s) => s.push);
  const [textPrompt, setTextPrompt] = useState('');
  const [orientedDetect, setOrientedDetect] = useState(false);

  const preannotate = useMutation({
    mutationFn: () => preannotateFrame(projectId, frameIdx),
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      qc.invalidateQueries({ queryKey: ['classes', projectId] });
      const n = added?.length ?? 0;
      pushToast(
        n === 0
          ? 'Pre-annotate: no new boxes (all overlapped).'
          : `Pre-annotate: added ${n} box${n === 1 ? '' : 'es'}.`,
        n === 0 ? 'warning' : 'success',
      );
    },
  });

  const refine = useMutation({
    mutationKey: ['sam'],
    mutationFn: () => refineToRotated(projectId, frameIdx),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['annotations', projectId, frameIdx] });
      const n = updated?.length ?? 0;
      pushToast(
        n === 0
          ? 'Refine: nothing to refine.'
          : `Refine: updated ${n} box${n === 1 ? '' : 'es'}.`,
        n === 0 ? 'warning' : 'success',
      );
    },
  });

  const textDetect = useMutation({
    mutationKey: ['sam'],
    mutationFn: async () => {
      return api
        .post(`projects/${projectId}/frames/${frameIdx}/text_detect`, {
          json: { prompt: textPrompt, oriented: orientedDetect },
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
          ? `"${textPrompt}": no new boxes (all overlapped existing).`
          : `"${textPrompt}": added ${n} box${n === 1 ? '' : 'es'}.`,
        n === 0 ? 'warning' : 'success',
      );
    },
  });

  const exportUrl = (fmt: string) => `/api/projects/${projectId}/export?format=${fmt}`;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-sm">
      <button
        onClick={() => preannotate.mutate()}
        disabled={preannotate.isPending}
        className="rounded bg-amber-600 px-4 py-1.5 text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
        title="Run object detection on the current frame"
      >
        {preannotate.isPending ? 'Pre-annotating…' : 'Pre-annotate'}
      </button>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (textPrompt.trim()) textDetect.mutate();
        }}
      >
        <input
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          placeholder='Text prompt ("cars")'
          className="w-52 rounded bg-slate-800 px-3 py-1.5 text-sm"
        />
        <label
          className="ml-1 flex cursor-pointer items-center gap-1 text-xs text-slate-300"
          title="Return rotated boxes instead of axis-aligned ones"
        >
          <input
            type="checkbox"
            checked={orientedDetect}
            onChange={(e) => setOrientedDetect(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-500"
          />
          Oriented
        </label>
        <button
          type="submit"
          disabled={!textPrompt.trim() || textDetect.isPending}
          className="rounded bg-violet-600 px-4 py-1.5 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          {textDetect.isPending ? 'Detecting…' : 'Detect'}
        </button>
        <button
          type="button"
          onClick={() => setInteractiveMode(!interactiveMode)}
          aria-pressed={interactiveMode}
          aria-label="Interactive selection"
          title="Interactive selection"
          className={`flex items-center justify-center rounded px-2.5 py-1.5 ring-1 ${
            interactiveMode
              ? 'bg-sky-600 text-white ring-sky-500 shadow-inner'
              : 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700'
          }`}
        >
          <Icon name="right_click" size={20} />
        </button>
      </form>

      <button
        onClick={() => refine.mutate()}
        disabled={refine.isPending}
        className="flex items-center gap-1.5 rounded bg-teal-600 px-4 py-1.5 text-sm font-medium hover:bg-teal-500 disabled:opacity-50"
        title="Refine every box on this frame to a rotated box using SAM"
      >
        <Icon name="crop_rotate" size={18} />
        {refine.isPending ? 'Refining…' : 'Refine to OBB'}
      </button>

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

