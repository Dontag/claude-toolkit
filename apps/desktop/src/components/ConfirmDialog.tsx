import { useConfirm } from "../stores/confirm";
import { Modal } from "./Modal";

/** Single app-wide confirm modal, driven by the confirm store.
 * Escape resolves false via the modal stack; Enter activates the focused
 * button — Modal's mount focus lands on the autoFocus Confirm, and Tab can
 * move to Cancel, so Enter always does what the focus ring shows. */
export function ConfirmDialog() {
  const current = useConfirm((s) => s.current);
  const respond = useConfirm((s) => s.respond);

  if (!current) return null;

  return (
    <Modal
      onClose={() => respond(false)}
      label={current.title}
      backdropClassName="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      panelClassName="hud-panel w-[360px] max-w-[90vw] p-5"
    >
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
    </Modal>
  );
}
