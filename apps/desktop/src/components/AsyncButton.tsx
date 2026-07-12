import { useState, type ReactNode } from "react";
import { Spinner } from "./Spinner";

interface Props {
  /** Async (or sync) action; the button shows a spinner + disables until it settles. */
  onClick: () => void | Promise<unknown>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}

/** A button that automatically shows a spinner and disables itself while its
 * onClick promise is in flight — so every network action (grant, deny, approve,
 * reject, request, graft, propose…) has consistent loading feedback. */
export function AsyncButton({ onClick, children, className = "", disabled, ...rest }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${className}`}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false); // no-op if the button already unmounted (list changed)
        }
      }}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}
