import { useEffect, useRef, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { bootstrapInventory, sourceState } from "./sources/bootstrap";
import { useInventory } from "./stores/inventory";
import { useUi } from "./stores/ui";
import { TreeView, sceneRef } from "./components/TreeView";
import { ItemPanel } from "./components/ItemPanel";
import { GalaxyTab } from "./components/GalaxyTab";
import { AuthMenu } from "./components/AuthMenu";
import { checkForUpdates } from "./updater";
import { useSession } from "./stores/session";
import { hydrateSharedState } from "./lib/publish";
import { joinGalaxyPresence, leaveGalaxyPresence, usePresence, userColor } from "./lib/presence";
import { galaxyConfigured } from "./lib/supabase";

export default function App() {
  const tab = useUi((s) => s.tab);
  const toast = useUi((s) => s.toast);
  const mode = useInventory((s) => s.mode);
  const rootLabel = useInventory((s) => s.rootLabel);
  const count = useInventory((s) => s.items.size);
  const searchRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      } else {
        leaveGalaxyPresence();
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        useUi.getState().select(null);
        sceneRef.current?.resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) return;
    const hit = [...useInventory.getState().items.values()].find(
      (i) => i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query),
    );
    if (hit) sceneRef.current?.focusItem(hit.id);
    else useUi.getState().showToast(`No item matching "${q}"`);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent text-text">
      <header className="z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-black/25 px-4 backdrop-blur-xl">
        <span className="text-sm font-bold tracking-tight">🌳 Claude Toolkit</span>
        <nav className="ml-2 flex gap-1">
          <TabButton id="personal" label="🌱 Personal Space" />
          <TabButton id="galaxy" label="🌌 Galaxy" />
        </nav>
        {tab === "personal" && (
          <input
            ref={searchRef}
            placeholder="Search fruits…  ( / )"
            className="ml-auto w-56 rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs outline-none transition focus:border-brand"
            onKeyDown={(e) => {
              if (e.key === "Enter") search(e.currentTarget.value);
            }}
          />
        )}
        <div className={tab === "personal" ? "" : "ml-auto"}>
          <AuthMenu />
        </div>
        <button
          className="rounded-full border border-border bg-black/30 px-3 py-1 text-[11px] text-muted transition hover:border-brand hover:text-text"
          title={mode === "local" ? "Open your .claude folder" : "Demo mode"}
          onClick={() => {
            if (sourceState.local) void revealItemInDir(sourceState.local.root).catch(() => {});
          }}
        >
          {mode === "local" ? `📂 ${rootLabel}` : "🔒 demo data"} · {count} items
        </button>
      </header>

      <main className="relative min-h-0 flex-1">
        {tab === "personal" ? (
          <>
            {ready && <TreeView />}
            <ItemPanel />
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-black/30 px-4 py-1.5 text-[11px] text-muted backdrop-blur">
              Drag to rotate · Scroll to zoom · Click a fruit · <kbd>/</kbd> search · <kbd>Esc</kbd> resets
            </div>
          </>
        ) : (
          <GalaxyTab />
        )}
      </main>

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
