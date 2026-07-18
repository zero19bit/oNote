import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import { Dashboard } from "./pages/Dashboard";
import { Skills } from "./pages/Skills";
import { SkillDetail } from "./pages/SkillDetail";
import { Notes } from "./pages/Notes";
import { NoteEditor } from "./pages/NoteEditor";
import { Snippets } from "./pages/Snippets";
import { Review } from "./pages/Review";
import { Resources } from "./pages/Resources";
import { ResourceViewer } from "./pages/ResourceViewer";
import { Projects } from "./pages/Projects";
import { Daily } from "./pages/Daily";
import { Inbox } from "./pages/Inbox";
import { GraphPage } from "./pages/GraphPage";
import { Settings } from "./pages/Settings";
import "./index.css";

// Hide the always-visible boot overlay once the React tree is mounted.
function hideBoot() {
  const fn = (window as any).__onoteBootHide;
  if (typeof fn === "function") fn();
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[onote] root render crashed", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 32,
            color: "#fca5a5",
            background: "#1a0d0d",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            position: "fixed",
            inset: 0,
            overflow: "auto",
            zIndex: 2147483647,
          }}
        >
          <strong>oNote failed to render.</strong>
          {"\n\n"}
          {String(this.state.error?.stack ?? this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  // Nothing to render into. The boot script will keep the message visible.
  console.error("[onote] mount failed: no element with id=\"root\"");
} else {
  try {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      // NOTE: StrictMode intentionally disabled — it double-invokes effects in dev,
      // which creates duplicate empty notes/snippets. Re-enable only when those
      // creation effects are ref-guarded.
      <RootErrorBoundary>
        <HashRouter>
          <Routes>
            <Route path="/" element={<App />}>
              <Route index element={<Dashboard />} />
              <Route path="skills" element={<Skills />} />
              <Route path="skills/:id" element={<SkillDetail />} />
              <Route path="notes" element={<Notes />} />
              <Route path="notes/:id" element={<NoteEditor />} />
              <Route path="snippets" element={<Snippets />} />
              <Route path="review" element={<Review />} />
              <Route path="resources" element={<Resources />} />
              <Route path="resources/:id/view" element={<ResourceViewer />} />
              <Route path="projects" element={<Projects />} />
              <Route path="daily" element={<Daily />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="graph" element={<GraphPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </RootErrorBoundary>
    );
    // React schedules the first commit asynchronously. A microtask after
    // the render call is enough to know the tree was committed without
    // an error.
    queueMicrotask(() => {
      requestAnimationFrame(() => hideBoot());
    });
  } catch (err) {
    console.error("[onote] failed to mount React tree", err);
  }
}
