import { useEffect, useState } from "react";
import { REFRESH_COOLDOWN_MS, refreshRemaining, useConnection } from "../stores/connection";
import { useUi } from "../stores/ui";

interface Props {
  /** does the actual refresh; should resolve when data is fresh */
  onRefresh: () => Promise<unknown>;
  label?: string;
}

/**
 * Rate-limited refresh. After a refresh it goes on an 8s cooldown (shared via
 * the connection store, so switching tabs can't bypass it) and shows a spinner
 * while running. Guards against offline use.
 */
export function RefreshButton({ onRefresh, label = "Refresh" }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const online = useConnection((s) => s.online);

  // tick the visible cooldown down each second
  useEffect(() => {
    const t = setInterval(() => setCooldown(Math.ceil(refreshRemaining() / 1000)), 250);
    return () => clearInterval(t);
  }, []);

  const disabled = spinning || cooldown > 0 || !online;

  const click = async () => {
    if (disabled) {
      if (!online) useUi.getState().showToast("You're offline — reconnect to refresh");
      else if (cooldown > 0) useUi.getState().showToast(`Please wait ${cooldown}s before refreshing again`);
      return;
    }
    setSpinning(true);
    useConnection.setState({ lastRefresh: Date.now() });
    try {
      await onRefresh();
    } catch {
      useUi.getState().showToast("Refresh failed — try again in a moment");
    } finally {
      setSpinning(false);
      setCooldown(Math.ceil(REFRESH_COOLDOWN_MS / 1000));
    }
  };

  return (
    <button
      onClick={click}
      title={!online ? "Offline" : cooldown > 0 ? `Wait ${cooldown}s` : label}
      aria-busy={spinning}
      className="flex items-center gap-1 rounded-full border border-border bg-black/30 px-3 py-1 text-[11px] text-muted transition hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
    >
      <span className={spinning ? "inline-block animate-spin" : ""}>↻</span>
      {spinning ? "Refreshing…" : cooldown > 0 ? `${cooldown}s` : label}
    </button>
  );
}
