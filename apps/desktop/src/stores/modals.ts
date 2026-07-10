// LIFO stack of open dialogs. The global Escape handler closes the top one
// and stops there, so hotkeys (deselect, camera reset) never fire "through"
// an open dialog — and `/` / Ctrl+R are suppressed while any dialog is up.
interface Entry {
  onClose: () => void;
}

const stack: Entry[] = [];

/** Register an open dialog; returns an unregister fn for unmount. */
export function pushModal(onClose: () => void): () => void {
  const entry: Entry = { onClose };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Close the topmost dialog. Returns false when none is open. */
export function closeTopModal(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.onClose();
  return true;
}

export function modalOpen(): boolean {
  return stack.length > 0;
}
