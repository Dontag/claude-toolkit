import { create } from "zustand";
import type { InventoryEvent, ToolkitItem } from "@claude-toolkit/core";

export type SourceMode = "local" | "demo";

interface InventoryState {
  items: Map<string, ToolkitItem>;
  mode: SourceMode;
  rootLabel: string; // e.g. C:\Users\you\.claude
  lastEvent: (InventoryEvent & { at: number }) | null;
  setAll: (items: ToolkitItem[], mode: SourceMode, rootLabel: string) => void;
  /** Diff a fresh scan against current state, emitting granular events. */
  reconcile: (items: ToolkitItem[]) => InventoryEvent[];
  applyEvent: (e: InventoryEvent) => void;
}

export const useInventory = create<InventoryState>((set, get) => ({
  items: new Map(),
  mode: "demo",
  rootLabel: "",
  lastEvent: null,

  setAll: (items, mode, rootLabel) =>
    set({ items: new Map(items.map((i) => [i.id, i])), mode, rootLabel }),

  reconcile: (fresh) => {
    const prev = get().items;
    const next = new Map(fresh.map((i) => [i.id, i]));
    const events: InventoryEvent[] = [];
    for (const [id, item] of next) {
      const old = prev.get(id);
      if (!old) events.push({ type: "added", item });
      else if (old.description !== item.description || old.name !== item.name) events.push({ type: "updated", item });
    }
    for (const id of prev.keys()) {
      if (!next.has(id)) events.push({ type: "removed", id });
    }
    if (events.length) set({ items: next, lastEvent: { ...events[events.length - 1]!, at: Date.now() } });
    return events;
  },

  applyEvent: (e) => {
    const items = new Map(get().items);
    if (e.type === "removed") items.delete(e.id);
    else items.set(e.item.id, e.item);
    set({ items, lastEvent: { ...e, at: Date.now() } });
  },
}));
