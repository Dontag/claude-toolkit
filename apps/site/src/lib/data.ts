import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ToolkitItem {
  id: string;
  name: string;
  kind: "skill" | "agent" | "command" | "hook";
  description: string;
  path: string;
  added: string;
  frontmatter: Record<string, unknown>;
}
export interface ChangelogEntry {
  date: string;
  title: string;
  detail: string;
  tokensSaved: number;
  type: "feature" | "fix" | "skill" | "session" | "release";
}
export interface Inventory {
  generatedAt: string;
  repoBase: string;
  items: ToolkitItem[];
  changelog: ChangelogEntry[];
}
export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
}
export interface Release {
  version: string;
  publishedAt: string;
  notes: string;
  assets: ReleaseAsset[];
}

const PUB = join(process.cwd(), "public", "data");

function readJson<T>(file: string): T | null {
  const p = join(PUB, file);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

export function loadInventory(): Inventory {
  const inv = readJson<Inventory>("inventory.json");
  if (!inv) throw new Error("public/data/inventory.json missing — run `pnpm generate` at the repo root first");
  return inv;
}

/** releases.json is produced by the site workflow from the GitHub API; absent before the first app release. */
export function loadReleases(): Release[] {
  return readJson<Release[]>("releases.json") ?? [];
}

export const KIND_META: Record<ToolkitItem["kind"], { label: string; color: string; emoji: string }> = {
  skill: { label: "Skills", color: "#ff6b7a", emoji: "🎯" },
  agent: { label: "Agents", color: "#ffb057", emoji: "🤖" },
  hook: { label: "Hooks", color: "#a78bfa", emoji: "🪝" },
  command: { label: "Commands", color: "#38d3e8", emoji: "⚡" },
};
