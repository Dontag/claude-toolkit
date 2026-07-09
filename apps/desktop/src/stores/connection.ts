import { create } from "zustand";

interface ConnectionState {
  online: boolean;
  /** last successful/attempted refresh (ms epoch), for the rate-limited button */
  lastRefresh: number;
}

export const useConnection = create<ConnectionState>(() => ({
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  lastRefresh: 0,
}));

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useConnection.setState({ online: true }));
  window.addEventListener("offline", () => useConnection.setState({ online: false }));
}

/** Minimum gap between manual refreshes (ms) — stops refresh-spamming the API. */
export const REFRESH_COOLDOWN_MS = 8000;

export function refreshRemaining(): number {
  return Math.max(0, REFRESH_COOLDOWN_MS - (Date.now() - useConnection.getState().lastRefresh));
}
