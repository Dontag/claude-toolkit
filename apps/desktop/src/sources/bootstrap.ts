// Boots the inventory: real ~/.claude when present, bundled demo data otherwise.
import { useInventory } from "../stores/inventory";
import { LocalFsSource } from "./local-fs";
import { loadDemoInventory } from "./static-json";
import { onLocalItemChanged } from "../lib/publish";

/** The live local source (null in demo mode). Components use it for file I/O. */
export const sourceState: { local: LocalFsSource | null } = { local: null };

let booted = false;

/** Wire a local source: initial scan + watcher that diffs and syncs.
 * External edits (any editor, or Claude itself) auto-push shared items
 * with Sync ON, or mark them "local ahead" when Sync is OFF. */
async function attachLocal(local: LocalFsSource): Promise<void> {
  sourceState.local = local;
  useInventory.getState().setAll(await local.scan(), "local", local.root);
  await local.subscribe(async () => {
    const fresh = await local.scan();
    const events = useInventory.getState().reconcile(fresh);
    for (const e of events) {
      if (e.type === "removed") continue;
      try {
        await onLocalItemChanged(e.item, await local.readFile(e.item));
      } catch {
        /* transient read failure mid-write — next event catches up */
      }
    }
  });
}

export async function bootstrapInventory(): Promise<void> {
  if (booted) return;
  booted = true;
  const local = await LocalFsSource.detect();
  if (local) await attachLocal(local);
  else useInventory.getState().setAll(await loadDemoInventory(), "demo", "demo data — no .claude folder found");
}

/** Manual rescan of the local tree (used by the Rescan button, catches any
 * change the OS watcher may have missed). Resolves false on failure so
 * callers can toast honestly; no-op success in demo mode. */
export async function rescanLocal(): Promise<boolean> {
  if (!sourceState.local) return true;
  try {
    const fresh = await sourceState.local.scan();
    useInventory.getState().reconcile(fresh);
    return true;
  } catch {
    return false;
  }
}

/** Create ~/.claude on demand (from demo mode) and go live. */
export async function initClaudeFolder(): Promise<boolean> {
  const local = await LocalFsSource.create();
  if (!local) return false;
  await attachLocal(local);
  return true;
}
