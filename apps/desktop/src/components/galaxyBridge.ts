// Imperative handles into the (lazy-loaded) Galaxy tab, kept in their own
// dependency-free module so callers in the always-loaded header (App search,
// notification center) can drive the Galaxy WITHOUT statically importing
// GalaxyTab — that keeps GalaxyTab + its three.js scene truly lazy.

/** Focus/select an item by a search query. */
export const galaxySearchRef: { current: ((q: string) => void) | null } = { current: null };
/** Deselect + fly the camera back to the default framing. */
export const galaxyResetRef: { current: (() => void) | null } = { current: null };
/** Select an item and drop straight into its propose editor (grantee flow). */
export const galaxyEditRef: { current: ((itemId: string) => void) | null } = { current: null };

let queuedEditId: string | null = null;

/** Open the editor for an item; queues if the Galaxy tab isn't mounted yet. */
export function requestGalaxyEdit(itemId: string): void {
  if (galaxyEditRef.current) galaxyEditRef.current(itemId);
  else queuedEditId = itemId;
}

/** GalaxyTab calls this on mount to run any edit queued before it existed. */
export function takeQueuedGalaxyEdit(): string | null {
  const id = queuedEditId;
  queuedEditId = null;
  return id;
}
