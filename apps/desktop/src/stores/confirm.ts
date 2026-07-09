import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  current: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  respond: (ok: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // if a dialog is already open, resolve it false first
      get().current?.resolve(false);
      set({ current: { ...opts, resolve } });
    }),
  respond: (ok) => {
    const cur = get().current;
    if (cur) {
      cur.resolve(ok);
      set({ current: null });
    }
  },
}));

/** Convenience: `await confirm({ title: "..." })`. */
export const confirm = (opts: ConfirmOptions) => useConfirm.getState().ask(opts);
