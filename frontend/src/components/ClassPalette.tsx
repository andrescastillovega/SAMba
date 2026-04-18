import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClass, deleteClass, updateClass, type Klass } from '../api/client';
import { useCanvas } from '../state/canvasStore';

const DEFAULT_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export default function ClassPalette({
  projectId,
  classes,
}: {
  projectId: number;
  classes: Klass[];
}) {
  const qc = useQueryClient();
  const activeClassId = useCanvas((s) => s.activeClassId);
  const setActiveClassId = useCanvas((s) => s.setActiveClassId);
  const hiddenClassIds = useCanvas((s) => s.hiddenClassIds);
  const toggleClassVisibility = useCanvas((s) => s.toggleClassVisibility);
  const hideAllClasses = useCanvas((s) => s.hideAllClasses);
  const showAllClasses = useCanvas((s) => s.showAllClasses);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const allHidden = classes.length > 0 && hiddenClassIds.length >= classes.length;

  const invalidateAfterClassChange = () => {
    qc.invalidateQueries({ queryKey: ['classes', projectId] });
    qc.invalidateQueries({ queryKey: ['annotations', projectId] });
    qc.invalidateQueries({ queryKey: ['tracks', projectId] });
  };

  const add = useMutation({
    mutationFn: () => {
      const color = DEFAULT_COLORS[classes.length % DEFAULT_COLORS.length];
      return createClass(projectId, name, color);
    },
    onSuccess: (cls) => {
      setName('');
      setActiveClassId(cls.id);
      invalidateAfterClassChange();
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      updateClass(projectId, id, { name }),
    onSuccess: (result, vars) => {
      setEditingId(null);
      if (result.id !== vars.id) {
        if (activeClassId === vars.id) setActiveClassId(result.id);
      }
      invalidateAfterClassChange();
    },
  });

  const recolor = useMutation({
    mutationFn: ({ id, color }: { id: number; color: string }) =>
      updateClass(projectId, id, { color }),
    onSuccess: () => invalidateAfterClassChange(),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteClass(projectId, id),
    onSuccess: (_, id) => {
      if (activeClassId === id) setActiveClassId(null);
      invalidateAfterClassChange();
    },
  });

  const startEdit = (c: Klass) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const confirmDelete = (c: Klass) => {
    const ok = window.confirm(
      `Delete class "${c.name}"?\n\nAll boxes and tracks with this label will also be removed.`,
    );
    if (ok) remove.mutate(c.id);
  };

  return (
    <div className="border-b border-slate-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Classes
        </h2>
        {classes.length > 0 && (
          <button
            onClick={() =>
              allHidden ? showAllClasses() : hideAllClasses(classes.map((c) => c.id))
            }
            className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title={allHidden ? 'Show all classes' : 'Hide all classes'}
          >
            {allHidden ? 'Show all' : 'Hide all'}
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {classes.map((c) => {
          const isEditing = editingId === c.id;
          const isHidden = hiddenClassIds.includes(c.id);
          return (
            <li key={c.id} className="group flex items-center gap-1">
              {isEditing ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = editingName.trim();
                    if (n && n !== c.name) rename.mutate({ id: c.id, name: n });
                    else setEditingId(null);
                  }}
                >
                  <label
                    className="relative inline-flex h-3 w-3 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-slate-700 hover:ring-slate-400"
                    style={{ backgroundColor: c.color }}
                    title="Change color"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="color"
                      value={c.color}
                      onChange={(e) => recolor.mutate({ id: c.id, color: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1 text-sm ring-1 ring-sky-500"
                  />
                </form>
              ) : (
                <>
                  <label
                    className="relative inline-flex h-4 w-4 shrink-0 cursor-pointer rounded-full ring-1 ring-slate-700 hover:ring-slate-400"
                    style={{ backgroundColor: c.color }}
                    title="Change color"
                  >
                    <input
                      type="color"
                      value={c.color}
                      onChange={(e) => recolor.mutate({ id: c.id, color: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <button
                    onClick={() => setActiveClassId(c.id)}
                    onDoubleClick={() => startEdit(c)}
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${
                      activeClassId === c.id ? 'bg-slate-800 ring-1 ring-sky-500' : 'hover:bg-slate-800'
                    } ${isHidden ? 'opacity-50' : ''}`}
                    title="Click to select, double-click to rename"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                      {c.annotation_count}
                    </span>
                  </button>
                  <button
                    onClick={() => toggleClassVisibility(c.id)}
                    className={`shrink-0 rounded px-1 py-1 hover:bg-slate-800 ${
                      isHidden ? 'text-slate-500' : 'text-slate-300'
                    }`}
                    title={isHidden ? 'Show class' : 'Hide class'}
                    aria-label={isHidden ? 'Show class' : 'Hide class'}
                  >
                    {isHidden ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  <button
                    onClick={() => confirmDelete(c)}
                    className="rounded px-1 text-xs text-slate-400 opacity-0 hover:bg-slate-800 hover:text-rose-400 group-hover:opacity-100"
                    title="Delete class (and its boxes)"
                  >
                    ✕
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="mt-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add class"
          className="flex-1 rounded bg-slate-800 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-sky-600 px-2 py-1 text-sm font-medium hover:bg-sky-500"
        >
          +
        </button>
      </form>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a19.6 19.6 0 0 1 4.22-5.22" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a19.63 19.63 0 0 1-3.17 4.19" />
      <path d="M1 1l22 22" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    </svg>
  );
}
