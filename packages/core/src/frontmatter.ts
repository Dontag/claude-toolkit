import matter from "gray-matter";
import type { ItemKind } from "./schema.js";

export interface ParsedItemFile {
  name: string;
  description: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Parse a toolkit markdown file (SKILL.md, agent .md, command .md).
 * Commands have no `name` in frontmatter — fall back to the given default
 * (derived from the filename by callers).
 */
export function parseItemFile(raw: string, defaultName: string): ParsedItemFile {
  const { data, content } = matter(raw);
  const fm = data as Record<string, unknown>;
  return {
    name: typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : defaultName,
    description: typeof fm.description === "string" ? fm.description.trim() : "",
    frontmatter: fm,
    body: content,
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
