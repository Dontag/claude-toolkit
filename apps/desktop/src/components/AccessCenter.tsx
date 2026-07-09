import { useEffect, useState } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";
import {
  denyRequest,
  grantRequest,
  markNotificationsRead,
  useAccess,
  type AppNotification,
} from "../lib/access";

const NOTE_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  grant_opened: () => "Your change request was granted — you have a 30-minute write window.",
  request_denied: () => "Your change request was denied.",
  grant_revoked: () => "A write grant was revoked.",
  grant_expired: () => "A write window expired — control returned to the owner.",
};

export function AccessCenter() {
  const session = useSession((s) => s.session);
  const incoming = useAccess((s) => s.incoming);
  const outgoing = useAccess((s) => s.outgoing);
  const notifications = useAccess((s) => s.notifications);
  const unread = useAccess((s) => s.unread);
  const showToast = useUi((s) => s.showToast);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && unread > 0) void markNotificationsRead();
  }, [open, unread]);

  if (!galaxyConfigured || !session) return null;
  const pending = incoming.length;
  const badge = unread + pending;

  return (
    <div className="relative">
      <button
        className="relative rounded-full border border-border bg-black/30 px-2.5 py-1 text-[13px] text-muted transition hover:border-brand hover:text-text"
        onClick={() => setOpen((o) => !o)}
        title="Requests & notifications"
      >
        🔔
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="hud-panel absolute right-0 top-10 z-50 max-h-[70vh] w-80 overflow-y-auto p-3">
          {pending > 0 && (
            <section className="mb-3">
              <div className="hud-label mb-1">Requests for your items</div>
              {incoming.map((r) => (
                <div key={r.id} className="mb-2 rounded-lg border border-border bg-black/20 p-2">
                  <div className="text-xs">
                    <strong>@{r.requesterHandle ?? "someone"}</strong> wants to edit{" "}
                    <span className="text-brand2">{r.itemNames?.join(", ") || "an item"}</span>
                  </div>
                  {r.message && <p className="mt-1 text-[11px] text-muted">“{r.message}”</p>}
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn-primary text-[11px]"
                      onClick={async () => {
                        if (await grantRequest(r.id)) showToast("✅ Granted — 30-minute window opened");
                        else showToast("Couldn't grant — an item may already be under a grant");
                      }}
                    >
                      Grant 30 min
                    </button>
                    <button
                      className="btn text-[11px]"
                      onClick={async () => {
                        if (await denyRequest(r.id)) showToast("Request denied");
                      }}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="mb-3">
              <div className="hud-label mb-1">Your requests</div>
              {outgoing.slice(0, 5).map((r) => (
                <div key={r.id} className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted">{r.itemNames?.join(", ") || "item"}</span>
                  <span className={r.status === "granted" ? "text-emerald-300" : "text-muted"}>{r.status}</span>
                </div>
              ))}
            </section>
          )}

          <div className="hud-label mb-1">Activity</div>
          {notifications.length === 0 ? (
            <p className="text-[11px] text-muted">Nothing yet.</p>
          ) : (
            notifications.slice(0, 20).map((n: AppNotification) => (
              <div key={n.id} className="mb-1 text-[11px] text-muted">
                {(NOTE_TEXT[n.type] ?? (() => n.type))(n.payload)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
