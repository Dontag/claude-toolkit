/** True when keystrokes belong to a text-entry surface — inputs, textareas,
 * selects, or contenteditable hosts (CodeMirror renders one) — so global
 * hotkeys like `/` and Escape must not fire there. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const ce = target.getAttribute("contenteditable");
  return ce === "" || ce === "true" || ce === "plaintext-only";
}
