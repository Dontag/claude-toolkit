import { useState } from "react";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { galaxyConfigured } from "../lib/supabase";
import { useSettings } from "../lib/settings";
import { useUi } from "../stores/ui";
import { useSession } from "../stores/session";
import { useInventory } from "../stores/inventory";
import { sourceState } from "../sources/bootstrap";
import { Modal } from "./Modal";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition ${on ? "bg-brand" : "bg-white/10"} disabled:opacity-40`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4.5" : "left-0.5"}`} />
    </button>
  );
}

/** Config panel — important toggles + environment status. */
export function ConfigPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const freeNav = useUi((u) => u.freeNav);
  const mode = useInventory((i) => i.mode);
  const rootLabel = useInventory((i) => i.rootLabel);
  const session = useSession((u) => u.session);

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between border-b border-border py-2.5">
      <div>
        <div className="text-xs">{label}</div>
        {hint && <div className="text-[10.5px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <Modal
      onClose={onClose}
      label="Configuration"
      panelClassName="hud-panel max-h-[calc(100vh-4rem)] w-full max-w-md overflow-y-auto p-5"
    >
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">⚙ Configuration</span>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <Row label="🔔 Notifications" hint="Activity feed & unread badge — requests and approvals always show">
          <Toggle on={s.notifications} onChange={s.setNotifications} />
        </Row>
        <Row label="✉️ Email notifications" hint={galaxyConfigured ? "Needs the notify-email edge function + provider" : "Sign-in backend not configured"}>
          <Toggle on={s.email} onChange={s.setEmail} disabled={!galaxyConfigured} />
        </Row>
        <Row label="🧭 Free navigation" hint="Center-lock off — pan freely">
          <Toggle on={freeNav} onChange={() => useUi.getState().toggleFreeNav()} />
        </Row>

        <div className="mt-3 rounded-lg border border-border bg-black/20 p-3 text-[11px] text-muted">
          <div className="mb-1 font-medium text-text">Environment</div>
          <div>Local source: {mode === "local" ? <span className="text-emerald-300">{rootLabel}</span> : "demo (no .claude)"}</div>
          <div>Galaxy backend: {galaxyConfigured ? <span className="text-emerald-300">connected</span> : <span className="text-amber-300">not configured</span>}</div>
          <div>Account: {session ? "signed in" : "signed out"}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {mode === "local" && (
            <button className="btn text-[11px]" onClick={() => sourceState.local && void revealItemInDir(sourceState.local.root).catch(() => {})}>
              📂 Open .claude folder
            </button>
          )}
          <button className="btn text-[11px]" onClick={() => void openUrl("https://github.com/Dontag/claude-toolkit").catch(() => {})}>
            🐙 Repo & docs
          </button>
          <button className="btn text-[11px]" onClick={() => void openUrl("https://github.com/Dontag/claude-toolkit/issues/new").catch(() => {})}>
            🐞 Report an issue
          </button>
        </div>
    </Modal>
  );
}

/** Header button that opens the config panel. */
export function ConfigButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="rounded-full border border-border bg-black/30 px-2.5 py-1 text-[13px] text-muted transition hover:border-brand hover:text-text"
        title="Configuration"
        onClick={() => setOpen(true)}
      >
        ⚙
      </button>
      {open && <ConfigPanel onClose={() => setOpen(false)} />}
    </>
  );
}
