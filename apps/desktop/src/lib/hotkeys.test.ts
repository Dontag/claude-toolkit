import { describe, expect, it } from "vitest";
import { isTextEntry } from "./hotkeys";

describe("isTextEntry", () => {
  it("claims inputs, textareas and selects", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isTextEntry(document.createElement(tag))).toBe(true);
    }
  });

  // regression (B1): CodeMirror renders a contenteditable div — global
  // hotkeys used to fire there, hijacking `/` and discarding drafts on Escape
  it("claims contenteditable hosts like CodeMirror", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true"); // what CodeMirror sets on .cm-content
    expect(isTextEntry(div)).toBe(true);
    const plaintext = document.createElement("div");
    plaintext.setAttribute("contenteditable", "plaintext-only");
    expect(isTextEntry(plaintext)).toBe(true);
  });

  it("ignores plain elements, window and null", () => {
    expect(isTextEntry(document.createElement("div"))).toBe(false);
    expect(isTextEntry(document.body)).toBe(false);
    expect(isTextEntry(window)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
