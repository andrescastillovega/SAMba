import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProject, listFrames, listClasses } from '../api/client';
import VideoUpload from '../components/VideoUpload';
import AnnotatorCanvas from '../components/AnnotatorCanvas';
import FrameTimeline from '../components/FrameTimeline';
import ClassPalette from '../components/ClassPalette';
import ActionBar from '../components/ActionBar';
import { useCanvas } from '../state/canvasStore';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const frameIdx = useCanvas((s) => s.frameIdx);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });
  const { data: frames = [] } = useQuery({
    queryKey: ['frames', projectId],
    queryFn: () => listFrames(projectId),
  });
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', projectId],
    queryFn: () => listClasses(projectId),
  });

  if (!project) return <div className="p-6 text-slate-400">Loading…</div>;

  if (frames.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-slate-400">No frames yet. Upload a video to extract frames.</p>
        <VideoUpload projectId={projectId} />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/40">
        <div className="border-b border-slate-800 px-4 py-3">
          <h1 className="truncate text-sm font-semibold">{project.name}</h1>
          <p className="text-xs text-slate-400">{frames.length} frames</p>
        </div>
        <ClassPalette projectId={projectId} classes={classes} />
      </aside>

      <section className="flex flex-1 flex-col">
        <ActionBar projectId={projectId} frameIdx={frameIdx} />
        <div className="relative flex-1 overflow-hidden bg-slate-950">
          <AnnotatorCanvas projectId={projectId} frameIdx={frameIdx} />
        </div>
        <FrameTimeline projectId={projectId} frames={frames} />
      </section>
    </div>
  );
}
