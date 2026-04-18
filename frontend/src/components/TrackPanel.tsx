import { useQuery } from '@tanstack/react-query';
import { api, type Track } from '../api/client';
import { useCanvas } from '../state/canvasStore';

export default function TrackPanel({ projectId }: { projectId: number }) {
  const selected = useCanvas((s) => s.selectedTrackId);
  const setSelected = useCanvas((s) => s.setSelectedTrackId);
  const correctionMode = useCanvas((s) => s.correctionMode);
  const setCorrectionMode = useCanvas((s) => s.setCorrectionMode);

  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks', projectId],
    queryFn: () => api.get(`projects/${projectId}/tracks`).json<Track[]>(),
  });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tracks</h2>
      {tracks.length === 0 ? (
        <p className="text-xs text-slate-500">No tracks yet.</p>
      ) : (
        <ul className="space-y-1">
          {tracks.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setSelected(t.id === selected ? null : t.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${
                  selected === t.id ? 'bg-slate-800 ring-1 ring-sky-500' : 'hover:bg-slate-800'
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: t.color ?? '#64748b' }}
                />
                Track {t.id}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected !== null && (
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={correctionMode}
            onChange={(e) => setCorrectionMode(e.target.checked)}
          />
          Correction mode (next click re-propagates)
        </label>
      )}
    </div>
  );
}
