/** Extensions a hook script can have on disk. */
export const HOOK_EXTS = ["py", "sh", "js", "mjs", "ps1"] as const;
export type HookExt = (typeof HOOK_EXTS)[number];

/**
 * Pick the file extension for a new hook: the picked file's extension wins,
 * then the shebang, then a light content sniff; Python is the default
 * (matches the toolkit's bundled hooks).
 */
export function inferHookExt(body: string, fromFileExt?: string): HookExt {
  const ext = fromFileExt?.toLowerCase();
  if (ext && (HOOK_EXTS as readonly string[]).includes(ext)) return ext as HookExt;
  const firstLine = body.trimStart().split("\n")[0] ?? "";
  if (firstLine.startsWith("#!")) {
    if (/python/i.test(firstLine)) return "py";
    if (/\b(ba|z|da)?sh\b/.test(firstLine)) return "sh";
    if (/\b(node|bun|deno)\b/.test(firstLine)) return "mjs";
    if (/\bpwsh|powershell\b/i.test(firstLine)) return "ps1";
  }
  if (/^\s*(param\s*\(|\[CmdletBinding|Write-Host\b)/im.test(body)) return "ps1";
  return "py";
}
