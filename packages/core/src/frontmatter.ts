import type { ItemKind } from "./schema.js";

export interface ParsedItemFile {
  name: string;
  description: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Minimal, dependency-free frontmatter parser (browser-safe — gray-matter
 * needs Node's Buffer, which the Tauri webview doesn't have).
 * Handles the flat `key: value` YAML this toolkit uses; quoted values are
 * unquoted; nested/multiline YAML is not supported (values kept as raw text).
 */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, unknown> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    data[kv[1]!] = v;
  }
  return { data, body: raw.slice(m[0].length) };
}

/**
 * Parse a toolkit markdown file (SKILL.md, agent .md, command .md).
 * Commands have no `name` in frontmatter — fall back to the given default
 * (derived from the filename by callers).
 */
export function parseItemFile(raw: string, defaultName: string): ParsedItemFile {
  const { data, body } = parseFrontmatter(raw);
  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : defaultName,
    description: typeof data.description === "string" ? data.description.trim() : "",
    frontmatter: data,
    body,
  };
}

/** Derive the item kind from a toolkit-relative path. */
export function kindFromPath(relPath: string): ItemKind | null {
  const top = relPath.replace(/\\/g, "/").split("/")[0];
  switch (top) {
    case "skills":
      return "skill";
    case "agents":
      return "agent";
    case "commands":
      return "command";
    case "hooks":
      return "hook";
    default:
      return null;
  }
}

/** Stable item id from a toolkit-relative path: "skills/headsoff/SKILL.md" → "skills/headsoff". */
export function idFromPath(relPath: string): string {
  const p = relPath.replace(/\\/g, "/");
  const parts = p.split("/");
  if (parts[0] === "skills" && parts.length >= 2) return `skills/${parts[1]}`;
  return p.replace(/\.(md|py|json)$/i, "");
}
