import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { ItemKind } from "@claude-toolkit/core";
import { sourceState } from "../sources/bootstrap";
import { useUi } from "../stores/ui";
import { confirm } from "../stores/confirm";
import { inferHookExt } from "../lib/hook-ext";
import { Modal } from "./Modal";

const KINDS: Array<{ k: ItemKind; label: string; emoji: string }> = [
  { k: "skill", label: "Skill", emoji: "🎯" },
  { k: "agent", label: "Agent", emoji: "🤖" },
  { k: "command", label: "Command", emoji: "⚡" },
  { k: "hook", label: "Hook", emoji: "🪝" },
];

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Create a new toolkit item on the personal tree — pick a file or paste text. */
export function AddItemDialog({ onClose }: { onClose: () => void }) {
  const showToast = useUi((s) => s.showToast);
  const [kind, setKind] = useState<ItemKind>("skill");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickedExt, setPickedExt] = useState<string | undefined>();

  const pickFile = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Toolkit file", extensions: ["md", "txt", "py", "sh", "js", "mjs", "ps1"] }],
      });
      if (typeof path !== "string") return;
      const text = await readTextFile(path);
      setBody(text);
      setPickedExt(/\.(\w+)$/.exec(path)?.[1]?.toLowerCase());
      if (!name) {
        const base = path.split(/[\\/]/).pop()?.replace(/\.(md|txt|py|sh|js|mjs|ps1)$/i, "") ?? "";
        setName(base === "SKILL" ? path.split(/[\\/]/).slice(-2, -1)[0] ?? "" : base);
      }
      showToast("File loaded — review and save");
    } catch {
      showToast("Couldn't read that file");
    }
  };

  // Escape/✕/Cancel go through here: a filled-in form deserves a confirm,
  // matching the editor and propose dialogs (no silent draft loss)
  const requestClose = async () => {
    if (name.trim() || desc.trim() || body.trim()) {
      const ok = await confirm({
        title: "Discard this new item?",
        message: "The name and content you've entered haven't been saved.",
        confirmLabel: "Discard",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const save = async () => {
    const local = sourceState.local;
    if (!local) return showToast("No .claude folder to save into");
    const slug = slugify(name);
    if (!slug) return showToast("Give it a name first");
    if (!body.trim()) return showToast("Content can't be empty");
    // hooks keep their script language (picked file ext, or shebang sniff)
    const hookExt = kind === "hook" ? inferHookExt(body, pickedExt) : undefined;
    if (await local.itemExists(kind, slug, hookExt)) {
      const ok = await confirm({
        title: `A ${kind} named "${slug}" already exists`,
        message: "Saving will overwrite it. Continue?",
        confirmLabel: "Overwrite",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await local.createItem(kind, slug, body, desc, hookExt);
      showToast(`🌱 ${slug} planted on your tree`);
      onClose();
    } catch {
      showToast("Couldn't save — is the file locked?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={() => void requestClose()}
      label="Add to your tree"
      panelClassName="hud-panel flex h-full max-h-[560px] w-full max-w-2xl flex-col p-5"
    >
        <div className="mb-3 flex items-center justify-between">
          <span className="hud-label" style={{ color: "#5fae7d" }}>
            ✚ Add to your tree
          </span>
          <button className="btn-ghost" onClick={() => void requestClose()}>
            ✕
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          {KINDS.map((x) => (
            <button
              key={x.k}
              onClick={() => setKind(x.k)}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs ${
                kind === x.k ? "border-brand bg-brand/20 text-text" : "border-border text-muted hover:text-text"
              }`}
            >
              {x.emoji} {x.label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:border-brand"
            placeholder="name (e.g. code-reviewer)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" onClick={pickFile}>
            📁 Pick file
          </button>
        </div>
        {kind !== "hook" && (
          <input
            className="mb-2 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-xs outline-none focus:border-brand"
            placeholder="one-line description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        )}
        <textarea
          className="min-h-0 flex-1 resize-none rounded-lg border border-border bg-black/30 p-3 font-mono text-[12px] outline-none focus:border-brand"
          placeholder={`Paste the ${kind}'s content here, or pick a file above…`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-1 text-[10px] text-muted">
          Saves to{" "}
          <span className="font-mono">
            {sourceState.local ? LocalPathHint(kind, name, kind === "hook" ? inferHookExt(body, pickedExt) : "py") : "~/.claude"}
          </span>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button className="btn" onClick={() => void requestClose()}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "🌱 Save to tree"}
          </button>
        </div>
    </Modal>
  );
}

function LocalPathHint(kind: ItemKind, name: string, hookExt: string): string {
  const slug = slugify(name) || "<name>";
  switch (kind) {
    case "skill":
      return `.claude/skills/${slug}/SKILL.md`;
    case "agent":
      return `.claude/agents/${slug}.md`;
    case "command":
      return `.claude/commands/${slug}.md`;
    case "hook":
      return `.claude/hooks/${slug}.${hookExt}`;
  }
}
