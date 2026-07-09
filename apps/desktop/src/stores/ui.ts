import { create } from "zustand";

export type Tab = "personal" | "galaxy";

interface UiState {
  tab: Tab;
  selectedId: string | null;
  editorOpen: boolean;
  toast: string | null;
  setTab: (t: Tab) => void;
  select: (id: string | null) => void;
  setEditorOpen: (open: boolean) => void;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set) => ({
  tab: "personal",
  selectedId: null,
  editorOpen: false,
  toast: null,
  setTab: (tab) => set({ tab }),
  select: (selectedId) => set({ selectedId, editorOpen: false }),
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  showToast: (toast) => {
    set({ toast });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
