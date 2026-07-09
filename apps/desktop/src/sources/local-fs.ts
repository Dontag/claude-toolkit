// LocalFsSource — binds the tree to the user's real Claude folder
// (C:\Users\<user>\.claude on Windows, ~/.claude elsewhere) via the Tauri fs
// plugin. Watches recursively with debounce; on any event it rescans and lets
// the store diff (item counts are tiny, a full rescan is cheaper than being
// clever about rename storms from atomic-save editors on Windows).
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  stat,
  watch,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";
import { parseItemFile, type InventoryEvent, type ItemKind, type ToolkitItem } from "@claude-toolkit/core";

const KIND_DIRS: Array<[string, ItemKind]> = [
  ["skills", "skill"],
  ["agents", "agent"],
  ["commands", "command"],
  ["hooks", "hook"],
];

async function fileAddedDate(path: string): Promise<string> {
  try {
    const s = await stat(path);
    const d = s.birthtime ?? s.mtime;
    if (d) return new Date(d).toISOString().slice(0, 10);
  } catch {
    /* stat can fail mid-write; fall through */
  }
  return new Date().toISOString().slice(0, 10);
}

export class LocalFsSource {
  private constructor(public readonly root: string) {}

  /** Resolve ~/.claude; returns null when the folder doesn't exist (demo mode). */
  static async detect(): Promise<LocalFsSource | null> {
    try {
      const root = await join(await homeDir(), ".claude");
      if (!(await exists(root))) return null;
      return new LocalFsSource(root);
    } catch {
      return null;
    }
  }

  /** Create ~/.claude and its kind subdirs, returning a live source. */
  static async create(): Promise<LocalFsSource | null> {
    try {
      const root = await join(await homeDir(), ".claude");
      for (const d of ["skills", "agents", "commands", "hooks"]) {
        await mkdir(await join(root, d), { recursive: true });
      }
      return new LocalFsSource(root);
    } catch {
      return null;
    }
  }

  async scan(): Promise<ToolkitItem[]> {
    const items: ToolkitItem[] = [];
    for (const [dir, kind] of KIND_DIRS) {
      const dirPath = await join(this.root, dir);
      if (!(await exists(dirPath))) continue;
      let entries;
      try {
        entries = await readDir(dirPath);
      } catch {
        continue;
      }
      for (const entry of entries) {
        try {
          if (kind === "skill" && entry.isDirectory) {
            const rel = `skills/${entry.name}/SKILL.md`;
            const full = await join(dirPath, entry.name, "SKILL.md");
            if (!(await exists(full))) continue;
            const parsed = parseItemFile(await readTextFile(full), entry.name);
            items.push({
              id: `skills/${entry.name}`,
              kind,
              path: rel,
              added: await fileAddedDate(full),
              name: parsed.name,
              description: parsed.description,
              frontmatter: parsed.frontmatter,
            });
          } else if (kind !== "skill" && entry.isFile) {
            const isMd = entry.name.endsWith(".md");
            const isHookScript = kind === "hook" && /\.(py|sh|js|mjs)$/.test(entry.name);
            if (!isMd && !isHookScript) continue;
            if (kind === "hook" && /^(manifest\.json|settings-hooks\.json)$/.test(entry.name)) continue;
            const full = await join(dirPath, entry.name);
            const base = entry.name.replace(/\.(md|py|sh|js|mjs)$/, "");
            let name = kind === "command" ? `/${base}` : base;
            let description = "";
            let frontmatter: Record<string, unknown> = {};
            if (isMd) {
              const parsed = parseItemFile(await readTextFile(full), name);
              name = kind === "command" ? name : parsed.name;
              description = parsed.description;
              frontmatter = parsed.frontmatter;
            } else {
              // hook scripts: first docstring/comment line as description
              const src = await readTextFile(full);
              const m = /^(?:#!.*\n)?(?:#\s*(.+)|"""\s*([^\n"]+))/m.exec(src);
              description = (m?.[1] ?? m?.[2] ?? "").trim();
            }
            items.push({
              id: `${dir}/${base}`,
              kind,
              path: `${dir}/${entry.name}`,
              added: await fileAddedDate(full),
              name,
              description,
              frontmatter,
            });
          }
        } catch {
          // unreadable entry mid-write — skip, next rescan will pick it up
        }
      }
    }
    return items;
  }

  /** Watch the whole root; callers rescan+diff on any burst of events. */
  async subscribe(onBurst: () => void): Promise<() => void> {
    const un = await watch(this.root, () => onBurst(), { recursive: true, delayMs: 300 });
    return un;
  }

  async readFile(item: ToolkitItem): Promise<string> {
    return readTextFile(await join(this.root, item.path));
  }

  async writeFile(item: ToolkitItem, content: string): Promise<void> {
    await writeTextFile(await join(this.root, item.path), content);
  }

  /** Delete an item's file (skills: the whole skill folder). */
  async deleteItem(item: ToolkitItem): Promise<void> {
    if (item.kind === "skill") {
      const dir = await join(this.root, item.id); // skills/<name>
      await remove(dir, { recursive: true });
    } else {
      await remove(await join(this.root, item.path));
    }
  }

  /** Write a file at a toolkit-relative path, creating parent dirs (grafting). */
  async writeNewFile(relPath: string, content: string): Promise<void> {
    const parts = relPath.replace(/\\/g, "/").split("/");
    if (parts.length > 1) {
      const dir = await join(this.root, ...parts.slice(0, -1));
      await mkdir(dir, { recursive: true });
    }
    await writeTextFile(await join(this.root, ...parts), content);
  }

  /** Create a starter skill (used by the onboarding "plant your first fruit"). */
  async plantSkill(name: string, description: string): Promise<void> {
    await this.createItem("skill", name, `# ${name}\n\nDescribe when and how to use this skill.\n`, description);
  }

  /** Relative path a new item of a given kind + slug should live at. */
  static pathFor(kind: ItemKind, slug: string): string {
    switch (kind) {
      case "skill":
        return `skills/${slug}/SKILL.md`;
      case "agent":
        return `agents/${slug}.md`;
      case "command":
        return `commands/${slug}.md`;
      case "hook":
        return `hooks/${slug}.py`;
    }
  }

  /**
   * Create a new toolkit item on disk. `body` is the user's content; if it has
   * no frontmatter and the kind expects it (skill/agent/command), a minimal
   * `name`/`description` block is prepended so the tree + Galaxy read it right.
   */
  async createItem(kind: ItemKind, slug: string, body: string, description = ""): Promise<string> {
    const rel = LocalFsSource.pathFor(kind, slug);
    let content = body;
    if (kind !== "hook" && !/^---\r?\n/.test(body.trimStart())) {
      const displayName = kind === "command" ? `/${slug}` : slug;
      content = `---\nname: ${displayName}\ndescription: ${description || slug}\n---\n\n${body}`;
    }
    await this.writeNewFile(rel, content);
    return rel;
  }

  /** True if an item of this kind+slug already exists (avoid clobbering). */
  async itemExists(kind: ItemKind, slug: string): Promise<boolean> {
    return exists(await join(this.root, LocalFsSource.pathFor(kind, slug)));
  }
}

export type { InventoryEvent };
