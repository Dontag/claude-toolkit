import { create } from "zustand";

export type Tab = "personal" | "galaxy";

interface UiState {
  tab: Tab;
  selectedId: string | null;
  editorOpen: boolean;
  toast: string | null;
  freeNav: boolean; // center-lock off → free navigation on both canvases
  setTab: (t: Tab) => void;
  select: (id: string | null) => void;
  setEditorOpen: (open: boolean) => void;
  showToast: (msg: string) => void;
  toggleFreeNav: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

const TAB_KEY = "ct_last_tab";
const savedTab = (typeof localStorage !== "undefined" && localStorage.getItem(TAB_KEY)) as Tab | null;

export const useUi = create<UiState>((set) => ({
  tab: savedTab === "galaxy" || savedTab === "personal" ? savedTab : "personal",
  selectedId: null,
  editorOpen: false,
  toast: null,
  freeNav: false,
  setTab: (tab) => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
    set({ tab, selectedId: null });
  },
  select: (selectedId) => set({ selectedId, editorOpen: false }),
  setEditorOpen: (editorOpen) => set({ editorOpen }),
  toggleFreeNav: () => set((s) => ({ freeNav: !s.freeNav })),
  showToast: (toast) => {
    set({ toast });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
