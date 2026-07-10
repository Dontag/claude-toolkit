import { useEffect, useRef } from "react";
import { pushModal } from "../stores/modals";

interface Props {
  /** Called when the dialog should close (Escape via the modal stack). */
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /** Classes for the panel (defaults to nothing — pass hud-panel etc.). */
  panelClassName?: string;
  /** Classes for the backdrop; override to change z-index or padding. */
  backdropClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared dialog shell: backdrop, dialog semantics, focus trap, and Escape
 * handling via the modal stack (App's global keydown calls closeTopModal).
 * Focus returns to the previously focused element on close.
 */
export function Modal({ onClose, label, panelClassName, backdropClassName, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const unregister = pushModal(() => closeRef.current());
    // move focus inside so keystrokes land in the dialog
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => {
      unregister();
      prev?.focus?.();
    };
  }, []);

  // trap Tab inside the panel
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const els = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
    );
    if (els.length === 0) return;
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={backdropClassName ?? "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={panelClassName}
      >
        {children}
      </div>
    </div>
  );
}

const FOCUSABLE = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
