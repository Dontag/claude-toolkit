import { useEffect, useState } from "react";

/** Re-renders each second; returns ms remaining until `iso` (0 when past). */
export function useCountdown(iso: string | null | undefined): number {
  const [ms, setMs] = useState(() => (iso ? Math.max(0, new Date(iso).getTime() - Date.now()) : 0));
  useEffect(() => {
    if (!iso) return setMs(0);
    const target = new Date(iso).getTime();
    const tick = () => setMs(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return ms;
}

export function fmtCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
