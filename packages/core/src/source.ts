import type { ToolkitItem } from "./schema.js";

export type InventoryEvent =
  | { type: "added"; item: ToolkitItem }
  | { type: "updated"; item: ToolkitItem }
  | { type: "removed"; id: string };

/**
 * A place toolkit items live: the local ~/.claude tree (desktop app),
 * a bundled inventory.json (demo mode), or Supabase (galaxy).
 */
export interface InventorySource {
  scan(): Promise<ToolkitItem[]>;
  subscribe(cb: (e: InventoryEvent) => void): () => void;
  readFile(item: ToolkitItem): Promise<string>;
  writeFile(item: ToolkitItem, content: string): Promise<void>;
}
