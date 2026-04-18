import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function VideoUpload({ projectId }: { projectId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [stride, setStride] = useState(1);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const onUpload = async () => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`projects/${projectId}/video`, {
        body: form,
        searchParams: { stride },
        timeout: 10 * 60 * 1000,
      });
      qc.invalidateQueries({ queryKey: ['frames', projectId] });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-3 rounded border border-slate-800 bg-slate-900/50 p-4">
      <label className="block text-sm font-medium">Video file</label>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <label className="block text-sm font-medium">
        Frame stride (1 = every frame)
        <input
          type="number"
          min={1}
          value={stride}
          onChange={(e) => setStride(Number(e.target.value) || 1)}
          className="ml-2 w-20 rounded bg-slate-800 px-2 py-1"
        />
      </label>
      <button
        disabled={!file || busy}
        onClick={onUpload}
        className="rounded bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? 'Extracting…' : 'Upload & extract frames'}
      </button>
    </div>
  );
}
