// Realtime presence: who's online drives the galaxy sky's energy, and
// publish/push/graft events fire a comet in the actor's color on every sky.
import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useSession } from "../stores/session";

export interface ActivityEvent {
  type: "publish" | "push" | "graft";
  userId: string;
  handle: string;
  at: number;
}

interface PresenceState {
  onlineCount: number;
  lastActivity: ActivityEvent | null;
}

export const usePresence = create<PresenceState>(() => ({
  onlineCount: 0,
  lastActivity: null,
}));

/** Deterministic per-user comet color (stable hue from the user id). */
export function userColor(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // hsl → rgb int, fixed 70% sat / 65% light so every user color glows nicely
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = 0.65 - 0.7 * Math.min(0.65, 1 - 0.65) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

let channel: RealtimeChannel | null = null;

export function joinGalaxyPresence(): void {
  if (!supabase || channel) return;
  const uid = useSession.getState().session?.user.id ?? `anon-${Math.random().toString(36).slice(2, 8)}`;
  channel = supabase.channel("galaxy", { config: { presence: { key: uid } } });
  channel
    .on("presence", { event: "sync" }, () => {
      usePresence.setState({ onlineCount: Object.keys(channel!.presenceState()).length });
    })
    .on("broadcast", { event: "activity" }, ({ payload }) => {
      usePresence.setState({ lastActivity: { ...(payload as Omit<ActivityEvent, "at">), at: Date.now() } });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void channel!.track({ online_at: new Date().toISOString() });
    });
}

export function leaveGalaxyPresence(): void {
  if (channel) {
    void channel.unsubscribe();
    channel = null;
    usePresence.setState({ onlineCount: 0 });
  }
}

export async function broadcastActivity(type: ActivityEvent["type"]): Promise<void> {
  const s = useSession.getState();
  if (!channel || !s.session) return;
  const event = { type, userId: s.session.user.id, handle: s.profile?.handle ?? "someone" };
  await channel.send({ type: "broadcast", event: "activity", payload: event });
  // broadcast doesn't echo to self — surface our own comet locally too
  usePresence.setState({ lastActivity: { ...event, at: Date.now() } });
}
