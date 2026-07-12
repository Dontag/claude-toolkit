import { useEffect, useRef, useState, type ReactNode } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { useClickOutside } from "../lib/useClickOutside";
import { Modal } from "./Modal";
import { AsyncButton } from "./AsyncButton";
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
import { requestGalaxyEdit } from "./galaxyBridge";

const NOTE_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  grant_opened: () => "Your change request was granted — you have a 30-minute write window.",
  request_denied: () => "Your change request was denied.",
  grant_revoked: () => "A write grant was revoked.",
  grant_expired: () => "A write window expired — control returned to the owner.",
  // the requester who proposed the edit hears back from the owner
  proposal_approved: () => "✅ The owner approved your proposed change — it's now live.",
  proposal_rejected: () => "❌ The owner rejected your proposed change.",
  proposal_pending: () => "✏️ Someone proposed a change to your item — review it above.",
};

const FIVE_DAYS = 5 * 864e5;
const within5Days = (iso: string) => Date.now() - new Date(iso).getTime() < FIVE_DAYS;

/** A titled section that collapses behind a count when it grows past `threshold`. */
function CollapsibleSection({
  title,
  total,
  threshold,
  children,
}: {
  title: string;
  total: number;
  threshold: number;
  children: ReactNode;
}) {
  const collapsible = total > threshold;
  const [expanded, setExpanded] = useState(false);
  const open = !collapsible || expanded;
  if (total === 0) return null;
  return (
    <section className="mb-3">
      <button
        className="mb-1 flex w-full items-center justify-between text-left hud-label disabled:cursor-default"
        onClick={() => collapsible && setExpanded((o) => !o)}
        disabled={!collapsible}
      >
        <span>
          {title} <span className="text-muted">({total})</span>
        </span>
        {collapsible && <span className="text-[10px] text-brand2">{expanded ? "▾ hide" : "▸ show all"}</span>}
      </button>
      {open && <div className="max-h-60 space-y-1 overflow-y-auto pr-0.5">{children}</div>}
    </section>
  );
}

export function AccessCenter() {
  const session = useSession((s) => s.session);
  const notificationsOn = useSettings((s) => s.notifications);
  const incoming = useAccess((s) => s.incoming);
  const outgoing = useAccess((s) => s.outgoing);
  const notifications = useAccess((s) => s.notifications);
  const grants = useAccess((s) => s.grants);
  const unread = useAccess((s) => s.unread);
  const uid = session?.user.id;
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
  // time-based sections are capped to the last 5 days
  const recentOutgoing = outgoing.filter((r) => within5Days(r.createdAt));
  const recentNotes = notifications.filter((n) => within5Days(n.createdAt));

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-black/30 text-[14px] text-muted transition hover:border-brand hover:text-text"
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
        // Mobile: fixed to the viewport (right-anchored, viewport-fit width) so
        // it never gets cropped off the left edge. Desktop: dropdown under the
        // bell. Still a DOM child of the root, so click-outside keeps working.
        <div className="hud-panel fixed right-2 top-14 z-50 max-h-[calc(100dvh-4.5rem)] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto p-3 sm:absolute sm:right-0 sm:top-10 sm:max-h-[70vh] sm:w-80">
          <CollapsibleSection title="Requests for your items" total={incoming.length} threshold={5}>
            {incoming.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-black/20 p-2">
                <div className="text-xs">
                  <strong>@{r.requesterHandle ?? "someone"}</strong> wants to edit{" "}
                  <span className="text-brand2">{r.itemNames?.join(", ") || "an item"}</span>
                </div>
                {r.message && <p className="mt-1 text-[11px] text-muted">“{r.message}”</p>}
                <div className="mt-2 flex gap-2">
                  <AsyncButton
                    className="btn-primary text-[11px]"
                    onClick={async () => {
                      if (await grantRequest(r.id)) showToast("✅ Granted — 30-minute window opened");
                      else showToast("Couldn't grant — an item may already be under a grant");
                    }}
                  >
                    Grant 30 min
                  </AsyncButton>
                  <AsyncButton
                    className="btn text-[11px]"
                    onClick={async () => {
                      if (await denyRequest(r.id)) showToast("Request denied");
                    }}
                  >
                    Deny
                  </AsyncButton>
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Changes awaiting your approval" total={proposals.length} threshold={5}>
            {proposals.map((p) => (
              <div key={p.id} className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2">
                <div className="text-xs">
                  <strong>@{p.proposerHandle ?? "someone"}</strong> edited{" "}
                  <span className="text-brand2">{p.itemName}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="btn text-[11px]" onClick={() => setReview(p)}>
                    Review
                  </button>
                  <AsyncButton
                    className="btn-primary text-[11px]"
                    onClick={async () => {
                      if (await approveProposal(p)) showToast(`✅ Applied — ${p.itemName} updated`);
                      else showToast("Couldn't approve");
                    }}
                  >
                    Approve
                  </AsyncButton>
                  <AsyncButton
                    className="btn-danger text-[11px]"
                    onClick={async () => {
                      if (await rejectProposal(p.id)) showToast("Proposal rejected");
                    }}
                  >
                    Reject
                  </AsyncButton>
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Your requests" total={recentOutgoing.length} threshold={5}>
            {recentOutgoing.map((r) => {
              // Edit only when there is a LIVE write grant to me on this item
              // (the grants map holds only unexpired grants). Request status
              // "granted" persists after the 30-min window lapses, so it can't
              // be the signal — otherwise every past grant would show Edit.
              const itemId = r.itemIds?.[0];
              const g = itemId ? grants.get(itemId) : undefined;
              const canEditNow = !!g && g.granteeId === uid;
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-muted">{r.itemNames?.join(", ") || "item"}</span>
                  {canEditNow && itemId ? (
                    <button
                      className="btn shrink-0 px-2 py-0.5 text-[10px] text-emerald-300"
                      title="You have a write window — open the editor"
                      onClick={() => {
                        setOpen(false);
                        useUi.getState().setTab("galaxy");
                        requestGalaxyEdit(itemId);
                      }}
                    >
                      ✏️ Edit
                    </button>
                  ) : (
                    <span className={`shrink-0 ${r.status === "granted" ? "text-emerald-300" : "text-muted"}`}>{r.status}</span>
                  )}
                </div>
              );
            })}
          </CollapsibleSection>

          {notificationsOn ? (
            recentNotes.length === 0 && pending === 0 && recentOutgoing.length === 0 ? (
              <p className="text-[11px] text-muted">Nothing yet.</p>
            ) : (
              <CollapsibleSection title="Activity · last 5 days" total={recentNotes.length} threshold={10}>
                {recentNotes.map((n: AppNotification) => (
                  <div key={n.id} className="text-[11px] text-muted">
                    {(NOTE_TEXT[n.type] ?? (() => n.type))(n.payload)}
                  </div>
                ))}
              </CollapsibleSection>
            )
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
              <AsyncButton
                className="btn-danger"
                onClick={async () => {
                  if (await rejectProposal(review.id)) showToast("Proposal rejected");
                  setReview(null);
                }}
              >
                Reject
              </AsyncButton>
              <AsyncButton
                className="btn-primary"
                onClick={async () => {
                  if (await approveProposal(review)) showToast(`✅ Applied — ${review.itemName} updated`);
                  else showToast("Couldn't approve");
                  setReview(null);
                }}
              >
                Approve — replace my {review.itemName}
              </AsyncButton>
            </div>
        </Modal>
      )}
    </div>
  );
}
