import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, listProjects } from '../api/client';

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () => createProject(name),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Projects</h1>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="flex-1 rounded bg-slate-900 px-3 py-2 ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className="rounded bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500 disabled:opacity-50"
        >
          Create
        </button>
      </form>

      <ul className="mt-8 grid gap-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              to={`/projects/${p.id}`}
              className="flex items-center justify-between rounded bg-slate-900 px-4 py-3 ring-1 ring-slate-800 hover:ring-sky-500"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-sm text-slate-400">
                {p.frame_count} frames{p.fps ? ` · ${p.fps.toFixed(1)} fps` : ''}
              </span>
            </Link>
          </li>
        ))}
        {projects.length === 0 && (
          <li className="text-slate-400">No projects yet — create one above.</li>
        )}
      </ul>
    </div>
  );
}
