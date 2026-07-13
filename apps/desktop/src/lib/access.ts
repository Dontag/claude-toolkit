// Phase 3 access management: change requests, exclusive 30-minute grants,
// and the notification center. Grant/deny/revoke go through security-definer
// RPCs (defined in the Phase-3 migration) so they're atomic and RLS-safe.
import { create } from "zustand";
import { supabase } from "./supabase";
import { useSession } from "../stores/session";
import type { GalaxyItem } from "./galaxy";

export interface ChangeRequest {
  id: string;
  requesterId: string;
  ownerId: string;
  toolkitId: string;
  message: string | null;
  status: "pending" | "granted" | "denied" | "expired" | "completed" | "cancelled";
  createdAt: string;
  requesterHandle?: string;
  itemNames?: string[];
  itemIds?: string[];
}

export interface ActiveGrant {
  id: string;
  itemId: string;
  granteeId: string;
  grantedBy: string;
  granteeHandle?: string; // who holds the lock (shown to other viewers)
  expiresAt: string; // ISO — the countdown target (server clock)
}

export interface AppNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface AccessState {
  incoming: ChangeRequest[]; // requests where I'm the owner, pending
  outgoing: ChangeRequest[]; // requests I filed
  grants: Map<string, ActiveGrant>; // itemId → live grant (mine as grantee OR on my items)
  notifications: AppNotification[];
  unread: number;
}

export const useAccess = create<AccessState>(() => ({
  incoming: [],
  outgoing: [],
  grants: new Map(),
  notifications: [],
  unread: 0,
}));

/** File a change request for one shared item (extends to multi-item easily). */
export async function requestChanges(item: GalaxyItem, message: string): Promise<"ok" | "self" | "error"> {
  if (!supabase) return "error";
  const uid = useSession.getState().session?.user.id;
  if (!uid) return "error";
  if (item.ownerId === uid) return "self";
  const { data: req, error } = await supabase
    .from("change_requests")
    .insert({ requester_id: uid, owner_id: item.ownerId, toolkit_id: await toolkitOf(item), message })
    .select("id")
    .single();
  if (error || !req) return "error";
  const { error: e2 } = await supabase.from("change_request_items").insert({ request_id: req.id, item_id: item.id });
  if (e2) return "error";
  return "ok";
}

async function toolkitOf(item: GalaxyItem): Promise<string> {
  const { data } = await supabase!.from("toolkit_items").select("toolkit_id").eq("id", item.id).single();
  return data!.toolkit_id as string;
}

/** Grant a 30-min window. Returns {ok:false, message} with the server's reason
 * so the UI can distinguish "genuinely locked" from a real failure. */
export async function grantRequest(requestId: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: "No backend" };
  const { error } = await supabase.rpc("grant_change_request", { p_request: requestId });
  if (error) return { ok: false, message: error.message };
  await refreshAccess();
  return { ok: true };
}
export async function denyRequest(requestId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("deny_change_request", { p_request: requestId });
  if (!error) await refreshAccess();
  return !error;
}
export async function revokeGrant(grantId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("revoke_grant", { p_grant: grantId });
  if (!error) await refreshAccess();
  return !error;
}

export async function markNotificationsRead(): Promise<void> {
  if (!supabase) return;
  const uid = useSession.getState().session?.user.id;
  if (!uid) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", uid);
  useAccess.setState((s) => ({ notifications: s.notifications.map((n) => ({ ...n, readAt: n.readAt ?? "now" })), unread: 0 }));
}

// Grant expiry is passive (a timestamp passing) — no realtime row event fires,
// so schedule a refresh at the earliest expiry to prune the map client-side.
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

/** Pull requests, live grants, and notifications for the signed-in user. */
export async function refreshAccess(): Promise<void> {
  if (!supabase) return;
  const uid = useSession.getState().session?.user.id;
  if (!uid) return;

  const [{ data: reqs }, { data: grants }, { data: notes }] = await Promise.all([
    supabase
      .from("change_requests")
      .select("id, requester_id, owner_id, toolkit_id, message, status, created_at, profiles!change_requests_requester_id_fkey(handle), change_request_items(item_id, toolkit_items(name))")
      .in("status", ["pending", "granted"])
      .order("created_at", { ascending: false }),
    supabase
      .from("access_grants")
      .select("id, item_id, grantee_id, granted_by, expires_at, profiles!access_grants_grantee_id_fkey(handle)")
      .is("revoked_at", null),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(40),
  ]);

  const mapReq = (r: Record<string, unknown>): ChangeRequest => ({
    id: r.id as string,
    requesterId: r.requester_id as string,
    ownerId: r.owner_id as string,
    toolkitId: r.toolkit_id as string,
    message: (r.message as string) ?? null,
    status: r.status as ChangeRequest["status"],
    createdAt: r.created_at as string,
    requesterHandle: (r.profiles as { handle?: string } | null)?.handle,
    itemNames: ((r.change_request_items as Array<{ toolkit_items: { name: string } }>) ?? []).map(
      (ci) => ci.toolkit_items.name,
    ),
    itemIds: ((r.change_request_items as Array<{ item_id: string }>) ?? []).map((ci) => ci.item_id),
  });

  const all = (reqs ?? []).map(mapReq);
  const now = Date.now();
  const grantMap = new Map<string, ActiveGrant>();
  for (const g of grants ?? []) {
    if (new Date(g.expires_at as string).getTime() > now) {
      grantMap.set(g.item_id as string, {
        id: g.id as string,
        itemId: g.item_id as string,
        granteeId: g.grantee_id as string,
        grantedBy: g.granted_by as string,
        granteeHandle: (g.profiles as { handle?: string } | null)?.handle,
        expiresAt: g.expires_at as string,
      });
    }
  }
  const notifications = (notes ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    payload: (n.payload as Record<string, unknown>) ?? {},
    readAt: (n.read_at as string) ?? null,
    createdAt: n.created_at as string,
  }));

  useAccess.setState({
    incoming: all.filter((r) => r.ownerId === uid && r.status === "pending"),
    outgoing: all.filter((r) => r.requesterId === uid),
    grants: grantMap,
    notifications,
    unread: notifications.filter((n) => !n.readAt).length,
  });

  clearTimeout(expiryTimer);
  if (grantMap.size) {
    const soonest = Math.min(...[...grantMap.values()].map((g) => new Date(g.expiresAt).getTime()));
    expiryTimer = setTimeout(() => void refreshAccess(), Math.max(1000, soonest - Date.now() + 2000));
  }
}

let subscribed = false;
export function subscribeAccess(): void {
  if (!supabase || subscribed) return;
  subscribed = true;
  supabase
    .channel("access")
    .on("postgres_changes", { event: "*", schema: "public", table: "change_requests" }, () => void refreshAccess())
    .on("postgres_changes", { event: "*", schema: "public", table: "access_grants" }, () => void refreshAccess())
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void refreshAccess())
    .subscribe();
}

/** For a local item that's shared: is it currently locked by a grant to someone else? */
export function grantStateFor(cloudItemId: string | undefined, myUserId: string | undefined) {
  if (!cloudItemId) return null;
  const g = useAccess.getState().grants.get(cloudItemId);
  if (!g) return null;
  return { grant: g, mine: g.granteeId === myUserId, msLeft: new Date(g.expiresAt).getTime() - Date.now() };
}
