import { useEffect } from "react";
import { useConfirm } from "../stores/confirm";

/** Single app-wide confirm modal, driven by the confirm store. */
export function ConfirmDialog() {
  const current = useConfirm((s) => s.current);
  const respond = useConfirm((s) => s.respond);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond(false);
      else if (e.key === "Enter") respond(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current, respond]);

  if (!current) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => respond(false)}
    >
      <div className="hud-panel w-[360px] max-w-[90vw] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold">{current.title}</h3>
        {current.message && <p className="mt-2 text-xs leading-relaxed text-muted">{current.message}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={() => respond(false)}>
            {current.cancelLabel ?? "Cancel"}
          </button>
          <button className={current.danger ? "btn-danger" : "btn-primary"} onClick={() => respond(true)} autoFocus>
            {current.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
