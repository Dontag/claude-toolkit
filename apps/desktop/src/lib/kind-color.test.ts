import { describe, expect, it } from "vitest";
import { kindColor, kindColorHex, kindLaneOrder, KNOWN_KIND_COLOR } from "./kind-color";

describe("kindColor", () => {
  it("keeps the brand palette for core kinds", () => {
    expect(kindColor("skill")).toBe(KNOWN_KIND_COLOR.skill);
    expect(kindColorHex("command")).toBe("#38d3e8");
  });

  // the whole point: whoever publishes a "plugin" first, every client
  // derives the same color for it forever
  it("is deterministic for unknown kinds", () => {
    expect(kindColor("plugin")).toBe(kindColor("plugin"));
    expect(kindColorHex("plugin")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("gives different kinds different colors", () => {
    expect(kindColor("plugin")).not.toBe(kindColor("theme"));
  });

  it("orders lanes core-first, then new kinds alphabetically", () => {
    expect(kindLaneOrder(["theme", "hook", "plugin", "skill"])).toEqual(["skill", "hook", "plugin", "theme"]);
  });
});
