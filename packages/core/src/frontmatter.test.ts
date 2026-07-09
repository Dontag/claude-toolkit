import { describe, expect, it } from "vitest";
import { idFromPath, kindFromPath, parseItemFile } from "./frontmatter.js";

describe("parseItemFile", () => {
  it("reads name + description from frontmatter", () => {
    const raw = `---\nname: headsoff\ndescription: Context guard.\n---\n\n# Body`;
    const p = parseItemFile(raw, "fallback");
    expect(p.name).toBe("headsoff");
    expect(p.description).toBe("Context guard.");
    expect(p.body.trim()).toBe("# Body");
  });

  it("falls back to defaultName when frontmatter has no name (commands)", () => {
    const raw = `---\ndescription: Ship it.\nargument-hint: "[version]"\n---\nBody`;
    const p = parseItemFile(raw, "ship");
    expect(p.name).toBe("ship");
    expect(p.frontmatter["argument-hint"]).toBe("[version]");
  });

  it("handles files without frontmatter", () => {
    const p = parseItemFile("just text", "guard");
    expect(p.name).toBe("guard");
    expect(p.description).toBe("");
  });
});

describe("kindFromPath / idFromPath", () => {
  it("maps top-level dirs to kinds", () => {
    expect(kindFromPath("skills/headsoff/SKILL.md")).toBe("skill");
    expect(kindFromPath("agents/bug-fixer.md")).toBe("agent");
    expect(kindFromPath("commands\\ship.md")).toBe("command");
    expect(kindFromPath("hooks/guard.py")).toBe("hook");
    expect(kindFromPath("dashboard/index.html")).toBeNull();
  });

  it("builds stable ids", () => {
    expect(idFromPath("skills/headsoff/SKILL.md")).toBe("skills/headsoff");
    expect(idFromPath("agents/bug-fixer.md")).toBe("agents/bug-fixer");
    expect(idFromPath("hooks/guard.py")).toBe("hooks/guard");
  });
});
