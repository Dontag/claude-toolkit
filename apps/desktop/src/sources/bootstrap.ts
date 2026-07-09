// Boots the inventory: real ~/.claude when present, bundled demo data otherwise.
import { useInventory } from "../stores/inventory";
import { LocalFsSource } from "./local-fs";
import { loadDemoInventory } from "./static-json";

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
      useInventory.getState().reconcile(fresh);
    });
  } else {
    inv.setAll(await loadDemoInventory(), "demo", "demo data — no .claude folder found");
  }
}
