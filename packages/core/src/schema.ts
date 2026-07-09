import { z } from "zod";

export const ItemKind = z.enum(["skill", "agent", "command", "hook"]);
export type ItemKind = z.infer<typeof ItemKind>;

export const ToolkitItem = z.object({
  /** stable slug, unique within a toolkit (e.g. "skills/headsoff") */
  id: z.string().min(1),
  name: z.string().min(1),
  kind: ItemKind,
  description: z.string().default(""),
  /** path relative to the toolkit root (e.g. "skills/headsoff/SKILL.md") */
  path: z.string().min(1),
  /** ISO date the item first appeared */
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** raw frontmatter (agents carry `tools`, commands `argument-hint`, …) */
  frontmatter: z.record(z.string(), z.unknown()).default({}),
});
export type ToolkitItem = z.infer<typeof ToolkitItem>;

export const ChangelogEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  detail: z.string().default(""),
  tokensSaved: z.number().int().nonnegative().default(0),
  type: z.enum(["feature", "fix", "skill", "session", "release"]).default("feature"),
});
export type ChangelogEntry = z.infer<typeof ChangelogEntry>;

export const Inventory = z.object({
  generatedAt: z.string(),
  repoBase: z.string(),
  items: z.array(ToolkitItem),
  changelog: z.array(ChangelogEntry),
});
export type Inventory = z.infer<typeof Inventory>;
