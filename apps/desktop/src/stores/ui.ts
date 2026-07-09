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

const TAB_KEY = "ct_last_tab";
const savedTab = (typeof localStorage !== "undefined" && localStorage.getItem(TAB_KEY)) as Tab | null;

export const useUi = create<UiState>((set) => ({
  tab: savedTab === "galaxy" || savedTab === "personal" ? savedTab : "personal",
  selectedId: null,
  editorOpen: false,
  toast: null,
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
  showToast: (toast) => {
    set({ toast });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
