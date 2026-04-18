import ky from 'ky';

export const api = ky.create({ prefixUrl: '/api', timeout: 60_000 });

export type Project = {
  id: number;
  name: string;
  fps: number | null;
  width: number | null;
  height: number | null;
  video_path: string | null;
  frame_count: number;
};

export type Frame = { id: number; idx: number; width: number; height: number };
export type Klass = { id: number; name: string; color: string; annotation_count: number };

export type AnnotationSource = 'auto' | 'manual' | 'propagated';

export type Annotation = {
  id: number;
  frame_id: number;
  class_id: number;
  track_id: number | null;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  rbbox_cx: number | null;
  rbbox_cy: number | null;
  rbbox_w: number | null;
  rbbox_h: number | null;
  rbbox_theta: number | null;
  polygon_json: string | null;
  source: AnnotationSource;
  confidence: number | null;
};

export type SamPoint = { x: number; y: number; label: 0 | 1 };

export const frameImageUrl = (projectId: number, frameIdx: number) =>
  `/api/projects/${projectId}/frames/${frameIdx}/image`;

export const listProjects = () => api.get('projects').json<Project[]>();
export const getProject = (id: number) => api.get(`projects/${id}`).json<Project>();
export const createProject = (name: string) =>
  api.post('projects', { json: { name } }).json<Project>();

export const listFrames = (projectId: number) =>
  api.get(`projects/${projectId}/frames`).json<Frame[]>();

export const listClasses = (projectId: number) =>
  api.get(`projects/${projectId}/classes`).json<Klass[]>();
export const createClass = (projectId: number, name: string, color: string) =>
  api.post(`projects/${projectId}/classes`, { json: { name, color } }).json<Klass>();

export const updateClass = (
  projectId: number,
  classId: number,
  payload: { name?: string; color?: string },
) => api.patch(`projects/${projectId}/classes/${classId}`, { json: payload }).json<Klass>();

export const deleteClass = (projectId: number, classId: number) =>
  api.delete(`projects/${projectId}/classes/${classId}`);

export const listAnnotations = (projectId: number, frameIdx: number) =>
  api
    .get(`projects/${projectId}/annotations`, { searchParams: { frame_idx: frameIdx } })
    .json<Annotation[]>();

export const deleteAnnotation = (projectId: number, annotationId: number) =>
  api.delete(`projects/${projectId}/annotations/${annotationId}`);

export const updateAnnotation = (
  projectId: number,
  annotationId: number,
  payload: Partial<Annotation>,
) =>
  api
    .patch(`projects/${projectId}/annotations/${annotationId}`, { json: payload })
    .json<Annotation>();

export const preannotateFrame = (projectId: number, frameIdx: number) =>
  api.post(`projects/${projectId}/frames/${frameIdx}/preannotate`).json<Annotation[]>();

export const samClick = (
  projectId: number,
  frameIdx: number,
  points: SamPoint[],
  box?: [number, number, number, number] | null,
) =>
  api
    .post(`projects/${projectId}/frames/${frameIdx}/sam_click`, {
      json: { points, box: box ?? null, multimask: true },
    })
    .json<{
      bbox_x1: number;
      bbox_y1: number;
      bbox_x2: number;
      bbox_y2: number;
      rbbox_cx: number;
      rbbox_cy: number;
      rbbox_w: number;
      rbbox_h: number;
      rbbox_theta: number;
      score: number;
      mask_polygon: number[][];
    }>();
