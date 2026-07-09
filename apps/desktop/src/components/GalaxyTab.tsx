// Galaxy tab — the shared universe. Star systems per user, realtime updates,
// graft-a-fruit installs. Falls back to a teaser when no backend is configured.
import { useEffect, useRef, useState } from "react";
import { galaxyConfigured } from "../lib/supabase";
import { fetchGalaxy, fetchItemContent, graftItem, subscribeGalaxy, useGalaxy, type GalaxyItem } from "../lib/galaxy";
import { joinGalaxyPresence, usePresence, userColor } from "../lib/presence";
import { GalaxyScene } from "../scene/galaxy-scene";
import { useSession } from "../stores/session";
import { useUi } from "../stores/ui";
import { RefreshButton } from "./RefreshButton";

const KIND_COLOR: Record<string, string> = {
  skill: "#ff6b7a",
  agent: "#ffb057",
  hook: "#a78bfa",
  command: "#38d3e8",
};

export function GalaxyTab() {
  if (!galaxyConfigured) return <GalaxyTeaser />;
  return <GalaxyLive />;
}

function GalaxyLive() {
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GalaxyScene | null>(null);
  const [selected, setSelected] = useState<GalaxyItem | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [grafting, setGrafting] = useState(false);
  const items = useGalaxy((s) => s.items);
  const loading = useGalaxy((s) => s.loading);
  const galaxyError = useGalaxy((s) => s.error);
  const online = usePresence((s) => s.onlineCount);
  const session = useSession((s) => s.session);
  const showToast = useUi((s) => s.showToast);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scene = new GalaxyScene({ onItemSelected: setSelected });
    scene.mount(el);
    sceneRef.current = scene;
    scene.setItems(useGalaxy.getState().items);
    void fetchGalaxy();
    subscribeGalaxy();
    joinGalaxyPresence();
    const unsubItems = useGalaxy.subscribe((s, prev) => {
      if (s.items !== prev.items) scene.setItems(s.items);
    });
    const unsubPresence = usePresence.subscribe((s, prev) => {
      if (s.onlineCount !== prev.onlineCount) scene.setActivity(s.onlineCount);
      if (s.lastActivity && s.lastActivity !== prev.lastActivity) {
        scene.cometPulse(userColor(s.lastActivity.userId));
      }
    });
    return () => {
      unsubItems();
      unsubPresence();
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    setContent(null);
    if (selected) void fetchItemContent(selected).then(setContent);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full">
      <div ref={ref} className="absolute inset-0 cursor-grab" />
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <div className="pointer-events-none rounded-full border border-border bg-black/30 px-4 py-1.5 text-[11px] text-muted backdrop-blur">
          {loading ? "Scanning the galaxy…" : `${items.length} shared items · ${online} online`}
          {!session && " · sign in to share yours"}
        </div>
        <RefreshButton onRefresh={fetchGalaxy} label="Refresh" />
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
        <aside className="absolute right-4 top-4 z-10 w-[340px] max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-border bg-glass p-4 backdrop-blur-xl shadow-2xl">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: KIND_COLOR[selected.kind] }}>
              {selected.kind}
            </span>
            <button className="btn-ghost" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <h3 className="mt-1 text-[15px] font-semibold">{selected.name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{selected.description}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            {selected.ownerAvatar && <img src={selected.ownerAvatar} alt="" className="h-4 w-4 rounded-full" />}
            @{selected.ownerHandle} · updated {selected.updatedAt.slice(0, 10)}
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
          </div>
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
    </div>
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
