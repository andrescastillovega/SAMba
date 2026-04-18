import { create } from 'zustand';
import type { SamPoint } from '../api/client';

type CanvasState = {
  frameIdx: number;
  setFrameIdx: (idx: number) => void;

  activeClassId: number | null;
  setActiveClassId: (id: number | null) => void;

  interactiveMode: boolean;
  setInteractiveMode: (v: boolean) => void;

  pendingPoints: SamPoint[];
  addPoint: (p: SamPoint) => void;
  clearPoints: () => void;

  previewMask: number[][] | null;
  setPreviewMask: (m: number[][] | null) => void;

  selectedAnnotationId: number | null;
  setSelectedAnnotationId: (id: number | null) => void;

  hiddenClassIds: number[];
  toggleClassVisibility: (id: number) => void;
  hideAllClasses: (ids: number[]) => void;
  showAllClasses: () => void;
};

export const useCanvas = create<CanvasState>((set) => ({
  frameIdx: 0,
  setFrameIdx: (idx) => set({ frameIdx: idx, pendingPoints: [], previewMask: null }),

  activeClassId: null,
  setActiveClassId: (id) => set({ activeClassId: id }),

  interactiveMode: false,
  setInteractiveMode: (v) => set({ interactiveMode: v, pendingPoints: [], previewMask: null }),

  pendingPoints: [],
  addPoint: (p) => set((s) => ({ pendingPoints: [...s.pendingPoints, p] })),
  clearPoints: () => set({ pendingPoints: [], previewMask: null }),

  previewMask: null,
  setPreviewMask: (m) => set({ previewMask: m }),

  selectedAnnotationId: null,
  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),

  hiddenClassIds: [],
  toggleClassVisibility: (id) =>
    set((s) => ({
      hiddenClassIds: s.hiddenClassIds.includes(id)
        ? s.hiddenClassIds.filter((x) => x !== id)
        : [...s.hiddenClassIds, id],
    })),
  hideAllClasses: (ids) => set({ hiddenClassIds: [...ids] }),
  showAllClasses: () => set({ hiddenClassIds: [] }),
}));
