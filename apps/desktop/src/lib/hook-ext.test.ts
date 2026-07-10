import { describe, expect, it } from "vitest";
import { inferHookExt } from "./hook-ext";

describe("inferHookExt", () => {
  it("prefers the picked file's extension", () => {
    expect(inferHookExt("anything", "sh")).toBe("sh");
    expect(inferHookExt("anything", "PS1")).toBe("ps1");
  });

  it("ignores unknown picked extensions", () => {
    expect(inferHookExt("plain text", "txt")).toBe("py");
  });

  it("reads the shebang", () => {
    expect(inferHookExt("#!/usr/bin/env python3\nprint('hi')")).toBe("py");
    expect(inferHookExt("#!/bin/bash\necho hi")).toBe("sh");
    expect(inferHookExt("#!/usr/bin/env node\nconsole.log(1)")).toBe("mjs");
    expect(inferHookExt("#!/usr/bin/env pwsh\nWrite-Host hi")).toBe("ps1");
  });

  // regression (B5): a pasted PowerShell hook used to be saved as .py
  it("sniffs PowerShell content without a shebang", () => {
    expect(inferHookExt('param($Path)\nWrite-Host "hook"')).toBe("ps1");
  });

  it("defaults to python", () => {
    expect(inferHookExt("import json\nprint('hook')")).toBe("py");
  });
});
