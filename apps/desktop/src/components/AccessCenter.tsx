import { useEffect, useRef, useState } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { useClickOutside } from "../lib/useClickOutside";
import { Modal } from "./Modal";
import { useSession } from "../stores/session";
import { useSettings } from "../lib/settings";
import { useUi } from "../stores/ui";
import {
  denyRequest,
  grantRequest,
  markNotificationsRead,
  useAccess,
  type AppNotification,
} from "../lib/access";
import { approveProposal, rejectProposal, useProposals, type Proposal } from "../lib/proposals";

const NOTE_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  grant_opened: () => "Your change request was granted — you have a 30-minute write window.",
  request_denied: () => "Your change request was denied.",
  grant_revoked: () => "A write grant was revoked.",
  grant_expired: () => "A write window expired — control returned to the owner.",
};

export function AccessCenter() {
  const session = useSession((s) => s.session);
  const notificationsOn = useSettings((s) => s.notifications);
  const incoming = useAccess((s) => s.incoming);
  const outgoing = useAccess((s) => s.outgoing);
  const notifications = useAccess((s) => s.notifications);
  const unread = useAccess((s) => s.unread);
  const proposals = useProposals((s) => s.pendingForMe);
  const showToast = useUi((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Proposal | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, () => setOpen(false), open);

  useEffect(() => {
    if (open && notificationsOn && unread > 0) void markNotificationsRead();
  }, [open, notificationsOn, unread]);

  // the bell must always render when signed in: it's the only UI for granting
  // requests and approving proposals — the notifications toggle only mutes
  // the activity feed and its unread badge
  if (!galaxyConfigured || !session) return null;
  const pending = incoming.length + proposals.length;
  const badge = pending + (notificationsOn ? unread : 0);

  return (
    <div className="relative" ref={rootRef}>
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

          {proposals.length > 0 && (
            <section className="mb-3">
              <div className="hud-label mb-1">Changes awaiting your approval</div>
              {proposals.map((p) => (
                <div key={p.id} className="mb-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">
                  <div className="text-xs">
                    <strong>@{p.proposerHandle ?? "someone"}</strong> edited{" "}
                    <span className="text-brand2">{p.itemName}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="btn text-[11px]" onClick={() => setReview(p)}>
                      Review
                    </button>
                    <button
                      className="btn-primary text-[11px]"
                      onClick={async () => {
                        if (await approveProposal(p)) showToast(`✅ Applied — ${p.itemName} updated`);
                        else showToast("Couldn't approve");
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-danger text-[11px]"
                      onClick={async () => {
                        if (await rejectProposal(p.id)) showToast("Proposal rejected");
                      }}
                    >
                      Reject
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

          {notificationsOn ? (
            <>
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
            </>
          ) : (
            pending === 0 && <p className="text-[11px] text-muted">Notifications are off — requests still appear here.</p>
          )}
        </div>
      )}

      {review && (
        <Modal
          onClose={() => setReview(null)}
          label={`Review proposal for ${review.itemName ?? "item"}`}
          panelClassName="hud-panel flex h-full max-h-[560px] w-full max-w-2xl flex-col p-5"
        >
            <div className="mb-2 flex items-center justify-between">
              <span className="hud-label">
                Proposed by @{review.proposerHandle} · {review.itemName}
              </span>
              <button className="btn-ghost" onClick={() => setReview(null)}>
                ✕
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-black/30 p-3 font-mono text-[11px] text-muted">
              {review.content}
            </pre>
            <div className="mt-3 flex justify-end gap-2">
              <button
                className="btn-danger"
                onClick={async () => {
                  if (await rejectProposal(review.id)) showToast("Proposal rejected");
                  setReview(null);
                }}
              >
                Reject
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (await approveProposal(review)) showToast(`✅ Applied — ${review.itemName} updated`);
                  else showToast("Couldn't approve");
                  setReview(null);
                }}
              >
                Approve — replace my {review.itemName}
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
