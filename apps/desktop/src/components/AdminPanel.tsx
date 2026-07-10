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
    <Modal
      onClose={onClose}
      label="Admin console"
      panelClassName="hud-panel flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col p-4"
    >
        <div className="mb-3 flex items-center justify-between">
          <span className="hud-label" style={{ color: "#ff6b7a" }}>
            🛡 Admin console
          </span>
          <button
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-muted transition hover:bg-white/10 hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1">
          {(["users", "grants", "toolkits", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${tab === t ? "bg-brand/20 text-text" : "text-muted hover:bg-white/5"}`}
            >
              {t}
            </button>
          ))}
          <button className="btn ml-auto text-[11px]" onClick={reload}>
            ↻ Reload
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto text-[11.5px]">
          {!data && <p className="p-2 text-muted">Loading…</p>}

          {data && tab === "users" && (
            <AdminTable head={["Handle", "Role", ""]}>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap py-2 pr-3 font-mono">@{u.handle}</td>
                  <td className={`py-2 pr-3 ${u.role === "admin" ? "text-brand2" : "text-muted"}`}>{u.role}</td>
                  <td className="py-2 text-right">
                    <button
                      className="btn text-[10px]"
                      onClick={() => act(setRole(u.id, u.role === "admin" ? "user" : "admin"), "Role updated")}
                    >
                      make {u.role === "admin" ? "user" : "admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}

          {data && tab === "grants" && (
            <AdminTable head={["Item", "Grantee", "Expires", ""]} empty={data.grants.length === 0 ? "No active grants." : undefined}>
              {data.grants.map((g) => (
                <tr key={g.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap py-2 pr-3 font-mono">{g.item_id.slice(0, 8)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-muted">{g.grantee_id.slice(0, 8)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">{new Date(g.expires_at).toLocaleTimeString()}</td>
                  <td className="py-2 text-right">
                    <button className="btn-danger text-[10px]" onClick={() => act(adminRevokeGrant(g.id), "Grant revoked")}>
                      force-revoke
                    </button>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}

          {data && tab === "toolkits" && (
            <AdminTable head={["Toolkit", "Status", "Set"]} empty={data.toolkits.length === 0 ? "No toolkits." : undefined}>
              {data.toolkits.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{t.name}</td>
                  <td className={`whitespace-nowrap py-2 pr-3 ${t.moderation_status === "active" ? "text-muted" : "text-red-300"}`}>
                    {t.moderation_status}
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-1">
                      {(["active", "hidden", "banned"] as const).map((s) => (
                        <button key={s} className="btn text-[10px]" onClick={() => act(setModeration(t.id, s), `Set ${s}`)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}

          {data && tab === "audit" && (
            <div className="divide-y divide-border/60">
              {data.audit.length === 0 && <p className="p-2 text-muted">No audit entries.</p>}
              {data.audit.map((a) => (
                <div key={a.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-medium text-text">{a.action}</span>
                  <span className="font-mono text-muted">{a.target_type}/{String(a.target_id).slice(0, 8)}</span>
                  <span className="ml-auto whitespace-nowrap text-[10.5px] text-muted">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
    </Modal>
  );
}

/** Shared table shell: horizontal scroll on narrow screens + a header row. */
function AdminTable({ head, empty, children }: { head: string[]; empty?: string; children: React.ReactNode }) {
  if (empty) return <p className="p-2 text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px]">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
            {head.map((h, i) => (
              <th key={i} className={`pb-1.5 font-medium ${i === head.length - 1 ? "text-right" : "pr-3"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-400/40 bg-red-400/10 text-[14px] text-red-300 transition hover:border-red-400 hover:bg-red-400/20"
        title="Admin console"
        onClick={() => setOpen(true)}
      >
        🛡
      </button>
      {open && <AdminPanel onClose={() => setOpen(false)} />}
    </>
  );
}
