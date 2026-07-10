import { useUi } from "../stores/ui";

/** Floating navigation-mode toggle, bottom-right of the canvas. */
export function FreeLockControl() {
  const freeNav = useUi((s) => s.freeNav);
  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1">
      <button
        onClick={() => useUi.getState().toggleFreeNav()}
        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium backdrop-blur transition ${
          freeNav
            ? "border-brand bg-brand/20 text-text shadow-[0_0_20px_rgba(143,131,255,0.35)]"
            : "border-border bg-black/40 text-muted hover:border-brand hover:text-text"
        }`}
        title={
          freeNav
            ? "Free flight: drag to look around, right-drag or Shift+drag to pan across X/Y/Z, scroll to move in/out."
            : "Locked orbit: drag orbits the centre, scroll zooms, idle auto-rotates."
        }
      >
        <span className="text-sm">{freeNav ? "🧭" : "🔒"}</span>
        <span className="flex flex-col leading-tight">
          <span>{freeNav ? "Free flight" : "Locked orbit"}</span>
          <span className="text-[9.5px] font-normal text-muted">{freeNav ? "fly anywhere" : "click to unlock"}</span>
        </span>
      </button>
    </div>
  );
}
