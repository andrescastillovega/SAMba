import { useToasts } from '../state/toastStore';

const STYLES: Record<string, string> = {
  info: 'border-slate-700 bg-slate-900 text-slate-100',
  success: 'border-emerald-600 bg-emerald-900/80 text-emerald-100',
  warning: 'border-amber-600 bg-amber-900/80 text-amber-100',
  error: 'border-rose-600 bg-rose-900/80 text-rose-100',
};

export default function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto min-w-[240px] max-w-md rounded border px-4 py-2 text-center text-sm shadow-lg ${STYLES[t.kind]}`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
