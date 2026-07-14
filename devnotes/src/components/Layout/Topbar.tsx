import { useLocation } from "react-router-dom";
import { Search, Plus, Zap } from "lucide-react";
import { useUI } from "@/store/ui";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Your knowledge at a glance" },
  "/skills": { title: "Skills Vault", subtitle: "Languages, frameworks, tools, concepts" },
  "/notes": { title: "Notes", subtitle: "Markdown notes & knowledge base" },
  "/snippets": { title: "Code Snippets", subtitle: "Reusable code, searchable & tagged" },
  "/review": { title: "Smart Review", subtitle: "Spaced-repetition review queue" },
  "/resources": { title: "Learning Resources", subtitle: "Articles, videos, courses, books" },
  "/projects": { title: "Projects & Goals", subtitle: "Track what you're building & learning" },
  "/daily": { title: "Daily Journal", subtitle: "Standup, journal, postmortem" },
  "/inbox": { title: "Inbox", subtitle: "Quick capture before sorting" },
  "/graph": { title: "Graph", subtitle: "Visualize your knowledge connections" },
  "/settings": { title: "Settings", subtitle: "Preferences and data management" },
};

export function Topbar() {
  const loc = useLocation();
  const key = loc.pathname.startsWith("/skills/")
    ? "/skills"
    : loc.pathname.startsWith("/notes/")
    ? "/notes"
    : loc.pathname;
  const meta = titles[key] ?? titles["/"];
  const toggle = useUI((s) => s.toggleCommandPalette);
  const capture = useUI((s) => s.toggleQuickCapture);

  return (
    <header className="h-14 border-b border-border bg-bg-surface/50 backdrop-blur flex items-center px-6 gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold truncate">{meta.title}</h1>
        <p className="text-xs text-fg-muted truncate">{meta.subtitle}</p>
      </div>

      <button
        onClick={toggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-inset border border-border hover:border-border-strong text-xs text-fg-muted w-72"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search anything...</span>
        <span className="kbd">Ctrl</span>
        <span className="kbd">K</span>
      </button>

      <button onClick={capture} className="btn-outline">
        <Zap size={14} />
        Quick Capture
        <span className="kbd ml-1">⌘⇧A</span>
      </button>

      <button
        onClick={() => {
          // context-aware "+" action based on current page
          const path = loc.pathname;
          if (path.startsWith("/skills")) {
            window.dispatchEvent(new CustomEvent("skills:new"));
          } else if (path.startsWith("/notes")) {
            window.dispatchEvent(new CustomEvent("notes:new"));
          } else if (path.startsWith("/snippets")) {
            window.dispatchEvent(new CustomEvent("snippets:new"));
          } else if (path.startsWith("/resources")) {
            window.dispatchEvent(new CustomEvent("resources:new"));
          } else if (path.startsWith("/projects")) {
            window.dispatchEvent(new CustomEvent("projects:new"));
          } else {
            capture();
          }
        }}
        className="btn-primary"
      >
        <Plus size={14} />
        New
      </button>
    </header>
  );
}
