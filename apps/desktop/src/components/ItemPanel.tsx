import { useEffect, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { join } from "@tauri-apps/api/path";
import { sourceState } from "../sources/bootstrap";
import { useInventory } from "../stores/inventory";
import { useUi } from "../stores/ui";
import { Editor } from "./Editor";

const KIND_COLOR: Record<string, string> = {
  skill: "#ff6b7a",
  agent: "#ffb057",
  hook: "#a78bfa",
  command: "#38d3e8",
};

export function ItemPanel() {
  const selectedId = useUi((s) => s.selectedId);
  const editorOpen = useUi((s) => s.editorOpen);
  const item = useInventory((s) => (selectedId ? s.items.get(selectedId) : undefined));
  const mode = useInventory((s) => s.mode);
  const showToast = useUi((s) => s.showToast);
  const [content, setContent] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setContent(null);
    setConfirming(false);
    useUi.getState().setEditorOpen(false);
    if (!item) return;
    if (sourceState.local) {
      sourceState.local
        .readFile(item)
        .then(setContent)
        .catch(() => setContent(null));
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

  return (
    <>
      <aside className="absolute right-4 top-16 z-10 w-[340px] max-h-[calc(100%-6rem)] overflow-y-auto rounded-2xl border border-border bg-glass p-4 backdrop-blur-xl shadow-2xl">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: KIND_COLOR[item.kind] }}
          >
            {item.kind}
          </span>
          <button className="btn-ghost" onClick={() => useUi.getState().select(null)}>
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

        {content !== null && !editorOpen && (
          <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-muted">
            {content}
          </pre>
        )}
      </aside>

      {editorOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-8 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-3xl flex-col rounded-2xl border border-border bg-[#0b0f22] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">
                Editing <span className="font-mono text-brand2">{item.path}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={save}>
                  💾 Save
                </button>
                <button className="btn" onClick={() => useUi.getState().setEditorOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Editor initial={content ?? ""} onChange={setDraft} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
