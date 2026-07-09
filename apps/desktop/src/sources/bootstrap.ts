// Boots the inventory: real ~/.claude when present, bundled demo data otherwise.
import { useInventory } from "../stores/inventory";
import { LocalFsSource } from "./local-fs";
import { loadDemoInventory } from "./static-json";
import { onLocalItemChanged } from "../lib/publish";

/** The live local source (null in demo mode). Components use it for file I/O. */
export const sourceState: { local: LocalFsSource | null } = { local: null };

let booted = false;

export async function bootstrapInventory(): Promise<void> {
  if (booted) return;
  booted = true;
  const inv = useInventory.getState();
  const local = await LocalFsSource.detect();
  if (local) {
    sourceState.local = local;
    inv.setAll(await local.scan(), "local", local.root);
    await local.subscribe(async () => {
      const fresh = await local.scan();
      const events = useInventory.getState().reconcile(fresh);
      // external edits (any editor, or Claude itself) auto-push shared items
      // with Sync ON, or mark them "local ahead" when Sync is OFF
      for (const e of events) {
        if (e.type === "removed") continue;
        try {
          await onLocalItemChanged(e.item, await local.readFile(e.item));
        } catch {
          /* transient read failure mid-write — next event catches up */
        }
      }
    });
  } else {
    inv.setAll(await loadDemoInventory(), "demo", "demo data — no .claude folder found");
  }
}
