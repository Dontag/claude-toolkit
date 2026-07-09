// Admin operations (visible only to profiles with role='admin'). All mutating
// calls go through security-definer RPCs that re-check is_admin() server-side.
import { supabase } from "./supabase";

export interface AdminUser {
  id: string;
  handle: string;
  role: "user" | "admin";
  created_at: string;
}
export interface AdminGrant {
  id: string;
  item_id: string;
  grantee_id: string;
  expires_at: string;
}
export interface AdminToolkit {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  moderation_status: string;
}
export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
}

export async function loadAdminData() {
  if (!supabase) return null;
  const [users, grants, toolkits, audit] = await Promise.all([
    supabase.from("profiles").select("id, handle, role, created_at").order("created_at", { ascending: false }),
    supabase.from("access_grants").select("id, item_id, grantee_id, expires_at").is("revoked_at", null),
    supabase.from("toolkits").select("id, name, slug, owner_id, moderation_status"),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    users: (users.data ?? []) as AdminUser[],
    grants: (grants.data ?? []) as AdminGrant[],
    toolkits: (toolkits.data ?? []) as AdminToolkit[],
    audit: (audit.data ?? []) as AuditEntry[],
  };
}

export const setRole = (userId: string, role: "user" | "admin") =>
  supabase!.rpc("admin_set_role", { p_user: userId, p_role: role });
export const setModeration = (toolkitId: string, status: string) =>
  supabase!.rpc("admin_set_toolkit_moderation", { p_toolkit: toolkitId, p_status: status });
export const adminRevokeGrant = (grantId: string) => supabase!.rpc("revoke_grant", { p_grant: grantId });
