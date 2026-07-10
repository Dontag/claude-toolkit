import { beforeEach, describe, expect, it } from "vitest";
import type { ToolkitItem } from "@claude-toolkit/core";
import { useInventory } from "./inventory";

const item = (over: Partial<ToolkitItem> = {}): ToolkitItem => ({
  id: "skills/demo",
  name: "demo",
  kind: "skill",
  description: "a demo skill",
  path: "skills/demo/SKILL.md",
  added: "2026-07-10",
  frontmatter: {},
  fingerprint: "100-1111",
  ...over,
});

describe("inventory.reconcile", () => {
  beforeEach(() => useInventory.getState().setAll([item()], "local", "~/.claude"));

  it("emits added and removed", () => {
    const added = item({ id: "agents/new", path: "agents/new.md", kind: "agent" });
    let events = useInventory.getState().reconcile([item(), added]);
    expect(events).toEqual([{ type: "added", item: added }]);
    events = useInventory.getState().reconcile([item()]);
    expect(events).toEqual([{ type: "removed", id: "agents/new" }]);
  });

  it("emits updated when the description changes", () => {
    const events = useInventory.getState().reconcile([item({ description: "changed" })]);
    expect(events.map((e) => e.type)).toEqual(["updated"]);
  });

  // regression (B2): body-only edits leave name/description untouched — the
  // fingerprint must still produce an "updated" event or Sync ON never pushes
  it("emits updated on a fingerprint-only change", () => {
    const events = useInventory.getState().reconcile([item({ fingerprint: "104-2222" })]);
    expect(events.map((e) => e.type)).toEqual(["updated"]);
  });

  it("stays quiet when nothing changed", () => {
    expect(useInventory.getState().reconcile([item()])).toEqual([]);
  });
});
