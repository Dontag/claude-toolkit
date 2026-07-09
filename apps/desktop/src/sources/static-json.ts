// StaticJsonSource — demo mode fallback when ~/.claude doesn't exist yet.
// Reads the bundled inventory.json produced by scripts/generate-inventory.mjs.
import { Inventory, type ToolkitItem } from "@claude-toolkit/core";

export async function loadDemoInventory(): Promise<ToolkitItem[]> {
  const res = await fetch("/data/inventory.json");
  if (!res.ok) return [];
  const parsed = Inventory.safeParse(await res.json());
  return parsed.success ? parsed.data.items : [];
}
