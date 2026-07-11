import { lazy, Suspense, useEffect, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { join } from "@tauri-apps/api/path";
import { sourceState } from "../sources/bootstrap";
import { useInventory } from "../stores/inventory";
import { useUi } from "../stores/ui";

// CodeMirror is heavy — only pull it in when the user actually opens the editor
const Editor = lazy(() => import("./Editor").then((m) => ({ default: m.Editor })));
import { galaxyConfigured } from "../lib/supabase";
import { useSession } from "../stores/session";
import { pushVersion, setSync, shareItem, unshareItem, usePublish } from "../lib/publish";
import { confirm } from "../stores/confirm";
import { useAccess } from "../lib/access";
import { fmtCountdown, useCountdown } from "../lib/useCountdown";
import { Modal } from "./Modal";

import { kindColorHex } from "../lib/kind-color";
import { Spinner } from "./Spinner";

export function ItemPanel() {
  const selectedId = useUi((s) => s.selectedId);
  const editorOpen = useUi((s) => s.editorOpen);
  const item = useInventory((s) => (selectedId ? s.items.get(selectedId) : undefined));
  const mode = useInventory((s) => s.mode);
  const showToast = useUi((s) => s.showToast);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setContent(null);
    setConfirming(false);
    useUi.getState().setEditorOpen(false);
    if (!item) return;
    if (sourceState.local) {
      setLoadingContent(true);
      sourceState.local
        .readFile(item)
        .then(setContent)
        .catch(() => setContent(null))
        .finally(() => setLoadingContent(false));
    }
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const local = sourceState.local;
  const isNew = Date.now() - new Date(item.added).getTime() < 7 * 864e5;

  const openInExplorer = async () => {
    if (!local) return;
    try {
      await revealItemInDir(await join(local.root, item.path));
    } catch {
      showToast("Couldn't open the file location");
    }
  };

  const save = async () => {
    if (!local) return;
    try {
      await local.writeFile(item, draft);
      setContent(draft);
      useUi.getState().setEditorOpen(false);
      showToast(`💾 ${item.name} saved`);
      // Sync switch ON → the save flies to the Galaxy immediately
      const meta = usePublish.getState().shared.get(item.id);
      if (meta?.syncOn) {
        if (await pushVersion(item, draft)) showToast(`💾 saved · ☄️ pushed to the Galaxy`);
      }
    } catch {
      showToast("Save failed — is the file locked?");
    }
  };

  const del = async () => {
    if (!local) return;
    try {
      await local.deleteItem(item);
      useUi.getState().select(null);
      showToast(`🍎 ${item.name} dropped from the tree`);
    } catch {
      showToast("Delete failed");
    }
  };

  const dirty = editorOpen && draft !== (content ?? "");
  const cancelEdit = async () => {
    if (dirty) {
      const discard = await confirm({
        title: "Discard unsaved changes?",
        message: "Your edits to this file haven't been saved.",
        confirmLabel: "Discard",
        danger: true,
      });
      if (!discard) return;
    }
    useUi.getState().setEditorOpen(false);
  };

  return (
    <>
      <aside className="hud-panel absolute right-4 top-16 z-10 w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100%-6rem)] overflow-y-auto p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="hud-label" style={{ color: kindColorHex(item.kind) }}>
            ◆ {item.kind}
          </span>
          <button
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-muted transition hover:bg-white/10 hover:text-text"
            onClick={() => useUi.getState().select(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <h3 className="mt-1 text-[15px] font-semibold">
          {isNew && <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
          {item.name}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
        <div className="mt-2 text-[11px] text-muted">
          Added {item.added} · <span className="font-mono">{item.path}</span>
        </div>

        {mode === "local" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn"
              onClick={() => {
                setDraft(content ?? "");
                useUi.getState().setEditorOpen(true);
              }}
              disabled={content === null}
            >
              ✏️ Edit
            </button>
            <button className="btn" onClick={openInExplorer}>
              📂 Show in folder
            </button>
            {!confirming ? (
              <button className="btn-danger" onClick={() => setConfirming(true)}>
                Remove
              </button>
            ) : (
              <span className="flex items-center gap-2 text-xs">
                Drop it like an apple?
                <button className="btn-danger" onClick={del}>
                  Yes
                </button>
                <button className="btn" onClick={() => setConfirming(false)}>
                  No
                </button>
              </span>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-border bg-black/20 p-2 text-[11.5px] text-muted">
            🔒 Demo data — no <span className="font-mono">.claude</span> folder found. Create{" "}
            <span className="font-mono">~/.claude/skills</span> and the tree goes live.
          </div>
        )}

        {mode === "local" && galaxyConfigured && <ShareControls itemId={item.id} content={content} />}

        {!editorOpen &&
          (loadingContent ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-black/20 p-3 text-[11px] text-muted">
              <Spinner /> Loading file…
            </div>
          ) : content !== null ? (
            <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-muted">
              {content}
            </pre>
          ) : null)}
      </aside>

      {/* editor modal */}
      {editorOpen && (
        <Modal
          onClose={() => void cancelEdit()}
          label={`Edit ${item.name}`}
          backdropClassName="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
          panelClassName="flex h-full w-full max-w-3xl flex-col rounded-2xl border border-border bg-[#0b0f22] p-4 shadow-2xl"
        >
          <div
            className="flex min-h-0 flex-1 flex-col"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void save();
              }
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">
                Editing <span className="font-mono text-brand2">{item.path}</span>
                {dirty && <span className="ml-2 text-[11px] text-amber-300">● unsaved</span>}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={save} disabled={!dirty}>
                  💾 Save <span className="opacity-60">Ctrl+S</span>
                </button>
                <button className="btn" onClick={cancelEdit}>
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
      )}
    </>
  );
}

/** Share-to-Galaxy toggle + Sync switch + Push button (signed-in, local mode). */
function ShareControls({ itemId, content }: { itemId: string; content: string | null }) {
  const session = useSession((s) => s.session);
  const item = useInventory((s) => s.items.get(itemId));
  const meta = usePublish((s) => s.shared.get(itemId));
  const busy = usePublish((s) => s.busy.has(itemId));
  const showToast = useUi((s) => s.showToast);
  // owner lockout: is my shared item currently under a grant to someone else?
  const grant = useAccess((s) => (meta ? s.grants.get(meta.cloudItemId) : undefined));
  const lockMs = useCountdown(grant?.expiresAt);
  const lockedByOther = !!grant && grant.granteeId !== session?.user.id && lockMs > 0;

  if (!session)
    return (
      <div className="mt-3 rounded-lg border border-border bg-black/20 p-2 text-[11.5px] text-muted">
        🌌 Sign in (top right) to share this to the Galaxy.
      </div>
    );
  if (!item) return null;

  const toggleShare = async () => {
    if (content === null) return;
    if (meta) {
      const ok = await confirm({
        title: `Remove "${item.name}" from the Galaxy?`,
        message: "It disappears from everyone's Galaxy. Version history is kept, so you can re-share later.",
        confirmLabel: "Remove",
        danger: true,
      });
      if (!ok) return;
      if (await unshareItem(item)) showToast(`🌑 ${item.name} removed from the Galaxy`);
      else showToast("Couldn't unshare — try again");
    } else {
      if (await shareItem(item, content)) showToast(`🌟 ${item.name} is now shining in the Galaxy`);
      else showToast("Share failed — are you online?");
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-black/20 p-3">
      {lockedByOther && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-300">
          <span>🔒 An editor has the write window — you're paused</span>
          <span className="font-mono">{fmtCountdown(lockMs)}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">🌌 Share to Galaxy</span>
        <button
          role="switch"
          aria-checked={!!meta}
          disabled={busy || content === null}
          onClick={toggleShare}
          className={`relative h-5 w-9 rounded-full transition ${meta ? "bg-brand" : "bg-white/10"} disabled:opacity-40`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${meta ? "left-4.5" : "left-0.5"}`}
          />
        </button>
      </div>
      {meta && (
        <>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11.5px] text-muted">☄️ Sync local changes automatically</span>
            <button
              role="switch"
              aria-checked={meta.syncOn}
              disabled={busy}
              onClick={() => void setSync(itemId, !meta.syncOn)}
              className={`relative h-5 w-9 rounded-full transition ${meta.syncOn ? "bg-brand" : "bg-white/10"} disabled:opacity-40`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${meta.syncOn ? "left-4.5" : "left-0.5"}`}
              />
            </button>
          </div>
          {!meta.syncOn && meta.localAhead && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-400/10 px-2 py-1.5">
              <span className="text-[11px] text-amber-300">Local is ahead of the Galaxy</span>
              <button
                className="btn text-[11px]"
                disabled={busy || content === null}
                onClick={async () => {
                  if (content !== null && (await pushVersion(item, content)))
                    showToast(`☄️ ${item.name} pushed to the Galaxy`);
                }}
              >
                ⬆ Push
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
