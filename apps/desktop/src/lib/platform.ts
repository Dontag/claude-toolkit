// Platform detection: the same bundle runs inside the Tauri desktop shell and
// as a plain web app (Galaxy-only mode — no local ~/.claude access).
export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const IS_WEB = !IS_TAURI;
