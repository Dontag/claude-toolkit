import { useEffect, useState } from "react";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";
import { Modal } from "./Modal";
import {
  adminRevokeGrant,
  loadAdminData,
  setModeration,
  setRole,
  type AdminGrant,
  type AdminToolkit,
  type AdminUser,
  type AuditEntry,
} from "../lib/admin";

/** Admin console — users, live grants, toolkit moderation, audit log. */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const showToast = useUi((s) => s.showToast);
  const [data, setData] = useState<{
    users: AdminUser[];
    grants: AdminGrant[];
    toolkits: AdminToolkit[];
    audit: AuditEntry[];
  } | null>(null);
  const [tab, setTab] = useState<"users" | "grants" | "toolkits" | "audit">("users");

  const reload = () => void loadAdminData().then(setData);
  useEffect(reload, []);

  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    showToast(error ? "Action failed (admin only)" : ok);
    if (!error) reload();
  };

  return (
    <Modal onClose={onClose} label="Admin console" panelClassName="hud-panel flex h-full w-full max-w-4xl flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="hud-label" style={{ color: "#ff6b7a" }}>
            ⚙ Admin console
          </span>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-1">
          {(["users", "grants", "toolkits", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1 text-xs capitalize ${tab === t ? "bg-brand/20 text-text" : "text-muted hover:bg-white/5"}`}
            >
              {t}
            </button>
          ))}
          <button className="btn ml-auto text-[11px]" onClick={reload}>
            ↻ Reload
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px]">
          {!data && <p className="text-muted">Loading…</p>}

          {data && tab === "users" && (
            <table className="w-full">
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-border">
                    <td className="py-1.5">@{u.handle}</td>
                    <td className={u.role === "admin" ? "text-brand2" : "text-muted"}>{u.role}</td>
                    <td className="text-right">
                      <button
                        className="btn text-[10px]"
                        onClick={() => act(setRole(u.id, u.role === "admin" ? "user" : "admin"), "Role updated")}
                      >
                        make {u.role === "admin" ? "user" : "admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data && tab === "grants" && (
            <table className="w-full">
              <tbody>
                {data.grants.length === 0 && <tr><td className="text-muted">No active grants.</td></tr>}
                {data.grants.map((g) => (
                  <tr key={g.id} className="border-b border-border">
                    <td className="py-1.5">item {g.item_id.slice(0, 8)}</td>
                    <td className="text-muted">→ {g.grantee_id.slice(0, 8)}</td>
                    <td className="text-muted">expires {new Date(g.expires_at).toLocaleTimeString()}</td>
                    <td className="text-right">
                      <button className="btn-danger text-[10px]" onClick={() => act(adminRevokeGrant(g.id), "Grant revoked")}>
                        force-revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data && tab === "toolkits" && (
            <table className="w-full">
              <tbody>
                {data.toolkits.map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="py-1.5">{t.name}</td>
                    <td className={t.moderation_status === "active" ? "text-muted" : "text-red-300"}>{t.moderation_status}</td>
                    <td className="text-right">
                      {(["active", "hidden", "banned"] as const).map((s) => (
                        <button
                          key={s}
                          className="btn ml-1 text-[10px]"
                          onClick={() => act(setModeration(t.id, s), `Set ${s}`)}
                        >
                          {s}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data && tab === "audit" && (
            <div>
              {data.audit.map((a) => (
                <div key={a.id} className="border-b border-border py-1 text-muted">
                  <span className="text-text">{a.action}</span> {a.target_type}/{String(a.target_id).slice(0, 8)} ·{" "}
                  {new Date(a.created_at).toLocaleString()}
                </div>
              ))}
            </div>
          )}
        </div>
    </Modal>
  );
}

/** Header button that opens the admin console (admins only). */
export function AdminButton() {
  const role = useSession((s) => s.profile?.role);
  const [open, setOpen] = useState(false);
  if (role !== "admin") return null;
  return (
    <>
      <button
        className="rounded-full border border-red-400/40 bg-black/30 px-2.5 py-1 text-[13px] text-red-300 transition hover:border-red-400"
        title="Admin console"
        onClick={() => setOpen(true)}
      >
        ⚙
      </button>
      {open && <AdminPanel onClose={() => setOpen(false)} />}
    </>
  );
}
