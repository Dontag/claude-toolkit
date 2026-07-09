#!/usr/bin/env node
// Generates apps/site/public/data/inventory.json from the toolkit content at
// the repo root (skills/, agents/, commands/, hooks/) + activity logs.
// Exits non-zero if any file has invalid frontmatter or the output fails
// schema validation. Single source of truth replacing hand-edited data.js.
//
// NOTE: the zod schema here mirrors packages/core/src/schema.ts (canonical).
// Keep them in sync — core is TS-source-only, so the generator inlines it to
// stay runnable with plain `node` and no build step.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { z } from "zod";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "apps", "site", "public", "data", "inventory.json");
const REPO_BASE = "https://github.com/Dontag/claude-toolkit";

const ToolkitItem = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["skill", "agent", "command", "hook"]),
  description: z.string().default(""),
  path: z.string().min(1),
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frontmatter: z.record(z.string(), z.unknown()).default({}),
});
const ChangelogEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  detail: z.string().default(""),
  tokensSaved: z.number().int().nonnegative().default(0),
  type: z.enum(["feature", "fix", "skill", "session", "release"]).default("feature"),
});
const Inventory = z.object({
  generatedAt: z.string(),
  repoBase: z.string(),
  items: z.array(ToolkitItem),
  changelog: z.array(ChangelogEntry),
});

/** First-commit date of a path, falling back to today (untracked new files). */
function addedDate(relPath) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--follow", "--diff-filter=A", "--format=%cs", "-1", "--", relPath],
      { cwd: ROOT, encoding: "utf8" },
    ).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    /* not a git checkout — fall through */
  }
  return new Date().toISOString().slice(0, 10);
}

function parseMd(relPath, defaultName) {
  const raw = readFileSync(join(ROOT, relPath), "utf8");
  let fm = {};
  try {
    fm = matter(raw).data ?? {};
  } catch (e) {
    errors.push(`${relPath}: invalid frontmatter YAML — ${e.reason ?? e.message}`);
  }
  return {
    name: typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : defaultName,
    description: typeof fm.description === "string" ? fm.description.trim() : "",
    frontmatter: fm,
  };
}

const items = [];
const errors = [];

// skills/*/SKILL.md
if (existsSync(join(ROOT, "skills"))) {
  for (const dir of readdirSync(join(ROOT, "skills"), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const rel = `skills/${dir.name}/SKILL.md`;
    if (!existsSync(join(ROOT, rel))) {
      errors.push(`${rel}: missing SKILL.md`);
      continue;
    }
    const p = parseMd(rel, dir.name);
    items.push({ id: `skills/${dir.name}`, kind: "skill", path: rel, added: addedDate(rel), ...p });
  }
}

// agents/*.md, commands/*.md
for (const [dirName, kind] of [["agents", "agent"], ["commands", "command"]]) {
  if (!existsSync(join(ROOT, dirName))) continue;
  for (const f of readdirSync(join(ROOT, dirName))) {
    if (!f.endsWith(".md")) continue;
    const rel = `${dirName}/${f}`;
    const base = f.replace(/\.md$/, "");
    const p = parseMd(rel, kind === "command" ? `/${base}` : base);
    items.push({ id: `${dirName}/${base}`, kind, path: rel, added: addedDate(rel), ...p });
  }
}

// hooks/ via manifest.json (scripts have no frontmatter)
const manifestPath = join(ROOT, "hooks", "manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [file, meta] of Object.entries(manifest)) {
    const rel = `hooks/${file}`;
    if (!existsSync(join(ROOT, rel))) {
      errors.push(`${rel}: listed in manifest.json but missing`);
      continue;
    }
    items.push({
      id: `hooks/${meta.name}`,
      name: meta.name,
      kind: "hook",
      description: meta.description ?? "",
      path: rel,
      added: addedDate(rel),
      frontmatter: {},
    });
  }
}

// changelog: seed.json + changelog.jsonl (newest first)
const changelog = [];
const seedPath = join(ROOT, "activity", "seed.json");
if (existsSync(seedPath)) changelog.push(...JSON.parse(readFileSync(seedPath, "utf8")));
const jsonlPath = join(ROOT, "activity", "changelog.jsonl");
if (existsSync(jsonlPath)) {
  for (const line of readFileSync(jsonlPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      changelog.push(JSON.parse(line));
    } catch {
      errors.push(`activity/changelog.jsonl: unparseable line: ${line.slice(0, 80)}`);
    }
  }
}
changelog.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

if (errors.length) {
  console.error("generate-inventory: content errors:\n  " + errors.join("\n  "));
  process.exit(1);
}

const inventory = Inventory.safeParse({
  generatedAt: new Date().toISOString(),
  repoBase: REPO_BASE,
  items: items.sort((a, b) => a.id.localeCompare(b.id)),
  changelog,
});
if (!inventory.success) {
  console.error("generate-inventory: schema validation failed:");
  console.error(inventory.error.format());
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(inventory.data, null, 2) + "\n", "utf8");
console.log(
  `generate-inventory: ${inventory.data.items.length} items, ${inventory.data.changelog.length} changelog entries → ${OUT}`,
);
