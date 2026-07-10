import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const ISSUES_URL = "https://github.com/Dontag/claude-toolkit/issues/new";

// Surface load/render errors onto the page (WebView devtools is off). In dev we
// show the full stack; in production a friendly card with a reload + report link.
function showError(label: string, err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  const el = document.getElementById("root");
  if (!el) return;
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  if (import.meta.env.DEV) {
    el.innerHTML = `<pre style="white-space:pre-wrap;padding:24px;font:12px/1.5 monospace;color:#ff9aa2;background:#0b0f22;height:100vh;overflow:auto">⚠ ${label}\n\n${esc(msg)}</pre>`;
  } else {
    el.innerHTML = `<div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#0b0f22;color:#e7e9f4;font:14px/1.6 Inter,system-ui,sans-serif">
      <div style="max-width:420px;text-align:center;padding:24px">
        <div style="font-size:40px">🛰️</div>
        <h2 style="margin:10px 0">Something went wrong</h2>
        <p style="color:#9aa3c7">The app hit an unexpected error. Reloading usually fixes it.</p>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
          <button onclick="location.reload()" style="padding:9px 18px;border-radius:10px;border:0;background:#8f83ff;color:#fff;font-weight:600;cursor:pointer">Reload</button>
          <a href="${ISSUES_URL}" target="_blank" style="padding:9px 18px;border-radius:10px;border:1px solid #97a1cc44;color:#e7e9f4;text-decoration:none">Report it</a>
        </div>
      </div></div>`;
  }
}
window.addEventListener("error", (e) => showError("window error", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => showError("unhandled promise rejection", e.reason));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: unknown }> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  componentDidCatch(err: unknown) {
    showError("React render error", err);
  }
  render() {
    return this.state.err ? null : this.props.children;
  }
}

try {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
  // React's LoadingScreen now owns the splash — drop the pre-paint boot logo
  document.getElementById("boot")?.remove();
} catch (err) {
  showError("mount error", err);
}
