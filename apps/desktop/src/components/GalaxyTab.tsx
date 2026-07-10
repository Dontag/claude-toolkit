// Galaxy tab — the shared universe. Star systems per user, realtime updates,
// graft-a-fruit installs. Falls back to a teaser when no backend is configured.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { fetchGalaxy, fetchItemContent, graftItem, subscribeGalaxy, useGalaxy, type GalaxyItem } from "../lib/galaxy";
import { joinGalaxyPresence, usePresence, userColor } from "../lib/presence";
import { GalaxyScene } from "../scene/galaxy-scene";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";
import { RefreshButton } from "./RefreshButton";
import { HudFrame } from "./HudFrame";
import { requestChanges, useAccess } from "../lib/access";
import { proposeChange } from "../lib/proposals";
import { fmtCountdown, useCountdown } from "../lib/useCountdown";
import { confirm } from "../stores/confirm";
import { Modal } from "./Modal";

const Editor = lazy(() => import("./Editor").then((m) => ({ default: m.Editor })));

/** Imperative hook so the header search box can drive the Galaxy tab. */
export const galaxySearchRef: { current: ((q: string) => void) | null } = { current: null };

const KIND_COLOR: Record<string, string> = {
  skill: "#ff6b7a",
  agent: "#ffb057",
  hook: "#a78bfa",
  command: "#38d3e8",
};

/** "Request changes" on someone else's item (hidden on your own). */
function RequestChangesButton({ item }: { item: GalaxyItem }) {
  const uid = useSession((s) => s.session?.user.id);
  const showToast = useUi((s) => s.showToast);
  if (!uid || item.ownerId === uid) return null;
  return (
    <button
      className="btn"
      onClick={async () => {
        const ok = await confirm({
          title: `Request edit access to "${item.name}"?`,
          message: "The owner can grant you an exclusive 30-minute window to edit it. They'll be notified.",
          confirmLabel: "Send request",
        });
        if (!ok) return;
        const r = await requestChanges(item, "");
        if (r === "ok") showToast("📨 Request sent to the owner");
        else if (r === "self") showToast("That's your own item");
        else showToast("Couldn't send request");
      }}
    >
      ✋ Request changes
    </button>
  );
}

/** Shows the live 30-minute grant countdown / padlock on the selected item. */
function GrantStatus({ itemId }: { itemId: string }) {
  const uid = useSession((s) => s.session?.user.id);
  const grant = useAccess((s) => s.grants.get(itemId));
  const ms = useCountdown(grant?.expiresAt);
  if (!grant || ms <= 0) return null;
  const mine = grant.granteeId === uid;
  return (
    <div
      className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px] ${
        mine ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"
      }`}
    >
      <span>{mine ? "🔓 You have the write window" : "🔒 Locked by another editor"}</span>
      <span className="font-mono">{fmtCountdown(ms)}</span>
    </div>
  );
}

export function GalaxyTab() {
  if (!galaxyConfigured) return <GalaxyTeaser />;
  return <GalaxyLive />;
}

function GalaxyLive() {
  const ref = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GalaxyScene | null>(null);
  const [selected, setSelected] = useState<GalaxyItem | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [grafting, setGrafting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const uid = useSession((s) => s.session?.user.id);
  const myGrant = useAccess((s) => (selected ? s.grants.get(selected.id) : undefined));
  // the countdown gate matters: grant expiry is passive, so without it the
  // Edit button would linger after the 30-minute window lapsed
  const grantMs = useCountdown(myGrant?.expiresAt);
  const canEdit = !!selected && !!myGrant && myGrant.granteeId === uid && grantMs > 0;
  const items = useGalaxy((s) => s.items);
  const loading = useGalaxy((s) => s.loading);
  const galaxyError = useGalaxy((s) => s.error);
  const online = usePresence((s) => s.onlineCount);
  const session = useSession((s) => s.session);
  const showToast = useUi((s) => s.showToast);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reticle = reticleRef.current;
    const scene = new GalaxyScene({
      onItemSelected: setSelected,
      onHover: (item) => {
        if (hoverRef.current) hoverRef.current.textContent = item ? item.name : "";
      },
      onReticle: (p) => {
        if (!reticle) return;
        if (p) {
          reticle.style.display = "block";
          reticle.style.left = `${p.x}px`;
          reticle.style.top = `${p.y}px`;
          if (hoverRef.current) {
            hoverRef.current.style.left = `${p.x + 30}px`;
            hoverRef.current.style.top = `${p.y - 10}px`;
            hoverRef.current.style.display = "block";
          }
        } else {
          reticle.style.display = "none";
          if (hoverRef.current) hoverRef.current.style.display = "none";
        }
      },
    });
    scene.mount(el);
    sceneRef.current = scene;
    scene.setItems(useGalaxy.getState().items);
    scene.setFreeNavigation(useUi.getState().freeNav);
    // Enter on the same query cycles matches; description counts like Personal
    let lastQ = "";
    let matchIdx = 0;
    galaxySearchRef.current = (q) => {
      const matches = useGalaxy
        .getState()
        .items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            i.ownerHandle.toLowerCase().includes(q),
        );
      if (matches.length === 0) {
        useUi.getState().showToast(`Nothing in the galaxy matches "${q}"`);
        return;
      }
      matchIdx = lastQ === q ? (matchIdx + 1) % matches.length : 0;
      lastQ = q;
      const hit = matches[matchIdx]!;
      scene.focusItemById(hit.id);
      setSelected(hit);
      if (matches.length > 1) useUi.getState().showToast(`${matchIdx + 1}/${matches.length} — Enter for next`);
    };
    void fetchGalaxy();
    subscribeGalaxy();
    joinGalaxyPresence();
    const unsubItems = useGalaxy.subscribe((s, prev) => {
      if (s.items !== prev.items) {
        scene.setItems(s.items);
        // keep the side panel honest: refresh the selected item from the new
        // data, and close it if the item was unshared/moderated away
        setSelected((sel) => (sel ? (s.items.find((i) => i.id === sel.id) ?? null) : sel));
      }
    });
    const unsubPresence = usePresence.subscribe((s, prev) => {
      if (s.onlineCount !== prev.onlineCount) scene.setActivity(s.onlineCount);
      if (s.lastActivity && s.lastActivity !== prev.lastActivity) {
        scene.cometPulse(userColor(s.lastActivity.userId));
      }
    });
    const unsubNav = useUi.subscribe((s, p) => {
      if (s.freeNav !== p.freeNav) scene.setFreeNavigation(s.freeNav);
    });
    return () => {
      unsubItems();
      unsubPresence();
      unsubNav();
      galaxySearchRef.current = null;
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    setContent(null);
    if (selected) void fetchItemContent(selected).then(setContent);
    // re-fetch when a realtime update moves the item's current version
  }, [selected?.id, selected?.currentVersionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full">
      <div ref={ref} className="absolute inset-0 cursor-grab" />
      <HudFrame accent="#7ce7f5" />
      {/* live targeting reticle + hover callsign (moved via refs, no re-render) */}
      <div ref={reticleRef} className="hud-reticle z-[6]" style={{ display: "none" }} />
      <div
        ref={hoverRef}
        className="pointer-events-none fixed z-[6] hud-label whitespace-nowrap text-[11px] text-text"
        style={{ display: "none" }}
      />
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <div className="hud-panel pointer-events-none px-4 py-1.5">
          <span className="hud-label">Galactic survey</span>
          <div className="mt-0.5 text-[11px] text-text">
            {loading ? "scanning…" : `${items.length} signatures · ${online} online`}
            {!session && " · sign in to share"}
          </div>
        </div>
        <RefreshButton onRefresh={fetchGalaxy} label="Rescan" />
      </div>

      {galaxyError && !loading && (
        <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-xl border border-red-400/40 bg-black/50 px-4 py-2 text-[12px] text-red-300 backdrop-blur">
          Couldn't reach the Galaxy: {galaxyError}
          <button className="ml-2 underline" onClick={() => void fetchGalaxy()}>
            retry
          </button>
        </div>
      )}

      {selected && (
        <aside className="hud-panel absolute right-4 top-4 z-10 w-[340px] max-h-[calc(100%-2rem)] overflow-y-auto p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label" style={{ color: KIND_COLOR[selected.kind] }}>
              ◆ {selected.kind} signature
            </span>
            <button className="btn-ghost" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight">{selected.name}</h3>
          {/* signal readout, ref image 2 */}
          <div className="mt-2 flex items-center gap-2">
            <span className="hud-label text-[9px]">signal</span>
            <div className="hud-bar flex-1">
              <i style={{ background: KIND_COLOR[selected.kind] }} />
            </div>
            <span className="hud-label text-[9px]">locked</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{selected.description}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            {selected.ownerAvatar && <img src={selected.ownerAvatar} alt="" className="h-4 w-4 rounded-full" />}
            system @{selected.ownerHandle} · updated {selected.updatedAt.slice(0, 10)}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-primary"
              disabled={grafting}
              onClick={async () => {
                if (!navigator.onLine) {
                  showToast("You're offline — reconnect to graft");
                  return;
                }
                setGrafting(true);
                try {
                  const r = await graftItem(selected);
                  if (r === "ok") showToast(`🌱 ${selected.name} grafted onto your tree`);
                  else if (r === "no-local") showToast("No local .claude folder to graft into");
                  else if (r === "no-content") showToast("This item has no content to graft yet");
                  else showToast("Graft failed — try again");
                } finally {
                  setGrafting(false);
                }
              }}
            >
              {grafting ? "Grafting…" : "🌱 Graft onto my tree"}
            </button>
            <RequestChangesButton item={selected} />
            {canEdit && (
              <button
                className="btn"
                onClick={() => {
                  setDraft(content ?? "");
                  setEditing(true);
                }}
              >
                ✏️ Edit (propose)
              </button>
            )}
          </div>
          <GrantStatus itemId={selected.id} />
          {content !== null && (
            <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-muted">
              {content}
            </pre>
          )}
        </aside>
      )}

      {!loading && items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-border bg-glass p-6 text-center backdrop-blur-xl">
            <div className="text-4xl">🌌</div>
            <p className="mt-2 max-w-xs text-sm text-muted">
              The galaxy is empty — be the first star. Share a skill from Personal Space with the
              <strong> Share to Galaxy</strong> toggle.
            </p>
          </div>
        </div>
      )}

      {editing && selected && (
        <ProposeModal
          item={selected}
          content={content}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/** Propose-changes editor. Cancel/Escape confirms before discarding a dirty
 * draft; Ctrl+Enter submits (same gate as the button). */
function ProposeModal({
  item,
  content,
  draft,
  setDraft,
  onClose,
}: {
  item: GalaxyItem;
  content: string | null;
  draft: string;
  setDraft: (v: string) => void;
  onClose: () => void;
}) {
  const showToast = useUi((s) => s.showToast);
  const canSubmit = !!draft.trim() && draft !== content;

  const submit = async () => {
    if (!canSubmit) return;
    const r = await proposeChange(item.id, draft);
    if (r === "ok") {
      showToast("📨 Change proposed — awaiting the owner's approval");
      onClose();
    } else if (r === "empty") showToast("A skill can't be made empty");
    else showToast("Couldn't propose — is your window still open?");
  };

  const cancel = async () => {
    if (draft !== (content ?? "")) {
      const ok = await confirm({
        title: "Discard proposed changes?",
        message: "Your draft hasn't been submitted to the owner.",
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <Modal
      onClose={() => void cancel()}
      label={`Propose changes to ${item.name}`}
      backdropClassName="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      panelClassName="flex h-full w-full max-w-3xl flex-col rounded-2xl border border-border bg-[#0b0f22] p-4 shadow-2xl"
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">
            Proposing changes to <span className="font-mono text-brand2">{item.name}</span>
            <span className="ml-2 text-[11px] text-amber-300">the owner must approve before it goes live</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!canSubmit} onClick={() => void submit()} title="Ctrl+Enter">
              📨 Submit proposal
            </button>
            <button className="btn" onClick={() => void cancel()}>
              Cancel
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Suspense fallback={<div className="p-4 text-xs text-muted">Loading editor…</div>}>
            <Editor initial={content ?? ""} onChange={setDraft} />
          </Suspense>
        </div>
      </div>
    </Modal>
  );
}

function GalaxyTeaser() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="stars-css absolute inset-0 opacity-70" />
      <div className="relative z-10 max-w-md rounded-2xl border border-border bg-glass p-8 text-center backdrop-blur-xl">
        <div className="text-5xl">🌌</div>
        <h2 className="mt-3 text-xl font-bold">The Galaxy needs a backend</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This build isn't connected to Supabase yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>apps/desktop/.env</code>, rebuild, and every
          user's published items appear here as star systems — with realtime comets as the community works.
        </p>
      </div>
    </div>
  );
}
