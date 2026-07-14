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
import { Projects } from "./pages/Projects";
import { Daily } from "./pages/Daily";
import { Inbox } from "./pages/Inbox";
import { GraphPage } from "./pages/GraphPage";
import { Settings } from "./pages/Settings";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // NOTE: StrictMode intentionally disabled — it double-invokes effects in dev,
  // which creates duplicate empty notes/snippets. Re-enable only when those
  // creation effects are ref-guarded.
  // <React.StrictMode>
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
          <Route path="projects" element={<Projects />} />
          <Route path="daily" element={<Daily />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="graph" element={<GraphPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  // </React.StrictMode>
);
