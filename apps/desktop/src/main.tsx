import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Dev-only: surface load/render errors onto the page (WebView devtools is off),
// so a blank screen shows the actual message instead of nothing.
function showError(label: string, err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  const el = document.getElementById("root");
  if (el)
    el.innerHTML =
      `<pre style="white-space:pre-wrap;padding:24px;font:12px/1.5 monospace;color:#ff9aa2;background:#0b0f22;height:100vh;overflow:auto">` +
      `⚠ ${label}\n\n${msg.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>`;
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
} catch (err) {
  showError("mount error", err);
}
