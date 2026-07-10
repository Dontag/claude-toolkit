import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { bootstrapInventory, sourceState } from "./sources/bootstrap";
import { useInventory } from "./stores/inventory";
import { useUi } from "./stores/ui";
import { TreeView, sceneRef } from "./components/TreeView";
import { ItemPanel } from "./components/ItemPanel";
import { AuthMenu } from "./components/AuthMenu";
import { AccessCenter } from "./components/AccessCenter";
import { AdminButton } from "./components/AdminPanel";
import { AddItemDialog } from "./components/AddItemDialog";
import { ConfigButton } from "./components/ConfigPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { refreshAccess, subscribeAccess, useAccess } from "./lib/access";
import { refreshProposals, subscribeProposals, useProposals } from "./lib/proposals";
import { usePublish } from "./lib/publish";
import { initClaudeFolder } from "./sources/bootstrap";

// The Galaxy pulls in a second three.js scene + realtime — only load it when opened
const GalaxyTab = lazy(() => import("./components/GalaxyTab").then((m) => ({ default: m.GalaxyTab })));
import { RefreshButton } from "./components/RefreshButton";
import { HudFrame } from "./components/HudFrame";
import { rescanLocal } from "./sources/bootstrap";
import { refreshRemaining, useConnection } from "./stores/connection";
import { fetchGalaxy } from "./lib/galaxy";
import { IS_WEB } from "./lib/platform";
import { checkForUpdates } from "./updater";
import LOGO from "./assets/logo.svg";
import { galaxySearchRef } from "./components/GalaxyTab";
import { FreeLockControl } from "./components/FreeLockControl";
import { LoadingScreen } from "./components/LoadingScreen";
import { useSession } from "./stores/session";
import { hydrateSharedState } from "./lib/publish";
import { joinGalaxyPresence, leaveGalaxyPresence, usePresence, userColor } from "./lib/presence";
import { galaxyConfigured } from "./lib/supabase";
import { isTextEntry } from "./lib/hotkeys";
import { closeTopModal, modalOpen } from "./stores/modals";

export default function App() {
  const tab = useUi((s) => s.tab);
  const toast = useUi((s) => s.toast);
  const mode = useInventory((s) => s.mode);
  const count = useInventory((s) => s.items.size);
  const onlineStatus = useConnection((s) => s.online);
  const searchRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (IS_WEB) {
      // web mode: Galaxy only — no local FS, no updater, no deep links
      useUi.getState().setTab("galaxy");
      setReady(true);
      return;
    }
    bootstrapInventory().finally(() => setReady(true));
    void checkForUpdates();
    // deep links: item links fly to a fruit; auth-callback completes OAuth
    let unlisten: (() => void) | undefined;
    onOpenUrl((urls) => {
      const url = urls[0] ?? "";
      if (url.startsWith("claude-toolkit://auth-callback")) {
        void useSession.getState().completeOAuth(url);
        return;
      }
      const m = /^claude-toolkit:\/\/item\/(.+)$/.exec(url);
      if (m) {
        useUi.getState().setTab("personal");
        sceneRef.current?.focusItem(decodeURIComponent(m[1]!));
      }
    })
      .then((u) => (unlisten = u))
      .catch(() => {}); // not registered in dev — fine
    return () => unlisten?.();
  }, []);

  // signed in → learn which local items are already shared + join presence
  useEffect(() => {
    if (!galaxyConfigured) return;
    const sync = (signedIn: boolean) => {
      if (signedIn) {
        void hydrateSharedState([...useInventory.getState().items.values()]);
        joinGalaxyPresence();
        void refreshAccess();
        subscribeAccess();
        void refreshProposals();
        subscribeProposals();
      } else {
        // sudden or intentional logout: drop realtime + clear stale cloud state
        leaveGalaxyPresence();
        usePublish.setState({ shared: new Map() });
        useAccess.setState({ incoming: [], outgoing: [], grants: new Map(), notifications: [], unread: 0 });
        useProposals.setState({ pendingForMe: [] });
        useUi.getState().showToast("Signed out — Galaxy is view-only until you sign back in");
      }
    };
    sync(!!useSession.getState().session);
    return useSession.subscribe((s, prev) => {
      if (!!s.session !== !!prev.session) sync(!!s.session);
    });
  }, []);

  // community activity → a comet streaks the Personal Space sky too
  useEffect(
    () =>
      usePresence.subscribe((s, prev) => {
        if (s.lastActivity && s.lastActivity !== prev.lastActivity) {
          sceneRef.current?.cometPulse(userColor(s.lastActivity.userId));
        }
        if (s.onlineCount !== prev.onlineCount) sceneRef.current?.setActivity?.(s.onlineCount);
      }),
    [],
  );

  // surface auth-callback failures even when the sign-in menu is closed
  useEffect(
    () =>
      useSession.subscribe((s, prev) => {
        if (s.authError && s.authError !== prev.authError) useUi.getState().showToast(s.authError);
      }),
    [],
  );

  // back online → refresh galaxy + re-learn shared state
  useEffect(() => {
    const onOnline = () => {
      useUi.getState().showToast("Back online");
      if (useSession.getState().session) {
        void hydrateSharedState([...useInventory.getState().items.values()]);
        if (galaxyConfigured) void fetchGalaxy();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // open dialogs win: close the top one and stop — never reset the
        // camera or drop the selection "through" a dialog (that used to
        // unmount the editor and silently discard unsaved drafts)
        if (closeTopModal()) return;
        if (isTextEntry(e.target)) {
          (e.target as HTMLElement).blur();
          return;
        }
        useUi.getState().select(null);
        sceneRef.current?.resetView();
        return;
      }
      // typing surfaces (inputs, CodeMirror) and open dialogs own their keys
      if (isTextEntry(e.target) || modalOpen()) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        // rate-limited refresh via keyboard; the button owns the cooldown
        e.preventDefault();
        if (refreshRemaining() > 0) {
          useUi.getState().showToast(`Please wait ${Math.ceil(refreshRemaining() / 1000)}s before refreshing`);
        } else if (!useConnection.getState().online) {
          useUi.getState().showToast("You're offline — reconnect to refresh");
        } else {
          useConnection.setState({ lastRefresh: Date.now() });
          void (useUi.getState().tab === "galaxy" ? fetchGalaxy() : rescanLocal()).then((ok) =>
            useUi.getState().showToast(ok ? "Refreshed" : "Refresh failed — try again"),
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // pressing Enter again on the same query cycles through the matches
  const cycleRef = useRef({ query: "", index: 0 });
  const search = (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) return;
    if (useUi.getState().tab === "galaxy") {
      galaxySearchRef.current?.(query);
      return;
    }
    const matches = [...useInventory.getState().items.values()].filter(
      (i) => i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query),
    );
    if (matches.length === 0) {
      useUi.getState().showToast(`No item matching "${q}"`);
      return;
    }
    const c = cycleRef.current;
    c.index = c.query === query ? (c.index + 1) % matches.length : 0;
    c.query = query;
    sceneRef.current?.focusItem(matches[c.index]!.id);
    if (matches.length > 1) useUi.getState().showToast(`${c.index + 1}/${matches.length} — Enter for next`);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent text-text">
      {/* overflow-x-auto: on narrow phones every control stays reachable by
          swiping the bar instead of silently clipping off-screen */}
      <header className="z-30 flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-black/30 px-3 backdrop-blur-xl [scrollbar-width:none]">
        {/* left: brand + tabs */}
        <img src={LOGO} alt="" className="h-6 w-6 shrink-0" />
        <span className="hidden text-sm font-bold tracking-tight sm:inline">Claude Galaxy</span>
        <nav className="ml-1 flex shrink-0 gap-1">
          {!IS_WEB && <TabButton id="personal" label="🌱 Personal" />}
          <TabButton id="galaxy" label="🌌 Galaxy" />
        </nav>

        {/* center: search (both tabs) */}
        <input
          ref={searchRef}
          placeholder={tab === "galaxy" ? "Search the galaxy…  ( / )" : "Search fruits…  ( / )"}
          className="ml-auto w-24 min-w-0 rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs outline-none transition focus:border-brand sm:w-40 md:w-56"
          onKeyDown={(e) => {
            if (e.key === "Enter") search(e.currentTarget.value);
          }}
        />

        {/* center-right: contextual actions */}
        {tab === "personal" && mode === "local" && (
          <>
            <button
              className="rounded-full border border-emerald-400/40 bg-black/30 px-3 py-1 text-[11px] text-emerald-300 transition hover:border-emerald-400"
              title="Add a skill, agent, command, hook or other Claude item to your tree"
              onClick={() => setAddOpen(true)}
            >
              ✚ Add
            </button>
            <RefreshButton onRefresh={rescanLocal} label="Rescan" />
          </>
        )}
        {tab === "galaxy" && <RefreshButton onRefresh={fetchGalaxy} label="Rescan" />}
        {!IS_WEB && (
          <button
            className="hidden rounded-full border border-border bg-black/30 px-3 py-1 text-[11px] text-muted transition hover:border-brand hover:text-text lg:inline"
            title={mode === "local" ? "Open your .claude folder" : "Demo mode"}
            onClick={() => {
              if (sourceState.local) void revealItemInDir(sourceState.local.root).catch(() => {});
            }}
          >
            {mode === "local" ? `📂 ${count}` : "🔒 demo"}
          </button>
        )}

        {/* far right: system + account */}
        <span className="mx-1 h-5 w-px bg-border" />
        <AdminButton />
        <AccessCenter />
        <ConfigButton />
        <AuthMenu />
      </header>

      {!onlineStatus && (
        <div className="z-30 shrink-0 bg-amber-500/15 px-4 py-1 text-center text-[11px] text-amber-300">
          ⚠ You're offline — Galaxy sharing and sync are paused. Local editing still works.
        </div>
      )}

      <main className="relative min-h-0 flex-1">
        {tab === "personal" ? (
          <>
            {ready && <TreeView />}
            <HudFrame accent="#5fae7d" />
            <ItemPanel />
            {ready && mode === "demo" && (
              <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-xl border border-emerald-400/40 bg-black/50 px-4 py-2 text-center text-[12px] text-emerald-200 backdrop-blur">
                No <span className="font-mono">.claude</span> folder yet — you're viewing demo data.
                <button
                  className="ml-2 underline"
                  onClick={async () => {
                    if (await initClaudeFolder()) useUi.getState().showToast("🌱 Created ~/.claude — your tree is live");
                    else useUi.getState().showToast("Couldn't create the folder");
                  }}
                >
                  Set up ~/.claude
                </button>
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full border border-border bg-black/30 px-4 py-1.5 text-[11px] text-muted backdrop-blur md:block">
              Drag to rotate · Scroll to zoom · Click a fruit · <kbd>/</kbd> search · <kbd>Esc</kbd> resets
            </div>
            <FreeLockControl />
          </>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted">Charting the galaxy…</div>
            }
          >
            <GalaxyTab />
            <FreeLockControl />
          </Suspense>
        )}
      </main>

      {addOpen && <AddItemDialog onClose={() => setAddOpen(false)} />}
      <ConfirmDialog />
      <LoadingScreen done={ready} />

      {toast && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-border bg-[#141a33] px-4 py-2 text-sm shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function TabButton({ id, label }: { id: "personal" | "galaxy"; label: string }) {
  const active = useUi((s) => s.tab === id);
  return (
    <button
      onClick={() => useUi.getState().setTab(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-brand/20 text-text" : "text-muted hover:bg-white/5 hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
