import { useEffect, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';

/**
 * Shows a full-screen overlay whenever a SAM-keyed mutation is in flight for
 * longer than SHOW_AFTER_MS. Meant to cover Modal cold-starts so the user
 * doesn't think the UI is frozen.
 */
const SHOW_AFTER_MS = 1500;

export default function ModelLoadingOverlay() {
  const mutating = useIsMutating({ mutationKey: ['sam'] });
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!mutating) {
      setVisible(false);
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const showTimer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const tick = window.setInterval(() => setElapsed(Date.now() - start), 500);
    return () => {
      window.clearTimeout(showTimer);
      window.clearInterval(tick);
    };
  }, [mutating]);

  if (!visible) return null;

  const seconds = Math.floor(elapsed / 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
      <div className="flex min-w-[280px] flex-col items-center gap-4 rounded-lg border border-slate-700 bg-slate-900 px-8 py-6 shadow-2xl">
        <svg
          className="h-10 w-10 animate-spin text-sky-400"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-100">Loading model</div>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
            {seconds}s elapsed
          </div>
        </div>
      </div>
    </div>
  );
}
