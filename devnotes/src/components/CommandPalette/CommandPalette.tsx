import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Hash, FileText, Code2, BookOpen, Target, Sparkles } from "lucide-react";
import { useUI } from "@/store/ui";
import { listNotes, listSkills, listSnippets, listResources, listProjects } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  title: string;
  subtitle: string;
  type: "page" | "skill" | "note" | "snippet" | "resource" | "project";
  to: string;
  icon: typeof Hash;
}

const pages: Result[] = [
  { id: "p1", title: "Dashboard", subtitle: "Overview", type: "page", to: "/", icon: Hash },
  { id: "p2", title: "Skills", subtitle: "Knowledge vault", type: "page", to: "/skills", icon: Sparkles },
  { id: "p3", title: "Notes", subtitle: "Markdown knowledge", type: "page", to: "/notes", icon: FileText },
  { id: "p4", title: "Snippets", subtitle: "Code library", type: "page", to: "/snippets", icon: Code2 },
  { id: "p5", title: "Review", subtitle: "Spaced repetition", type: "page", to: "/review", icon: Hash },
  { id: "p6", title: "Resources", subtitle: "Learning queue", type: "page", to: "/resources", icon: BookOpen },
  { id: "p7", title: "Projects", subtitle: "Goals & projects", type: "page", to: "/projects", icon: Target },
];

export function CommandPalette() {
  const open = useUI((s) => s.commandPaletteOpen);
  const setOpen = useUI((s) => s.setCommandPalette);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Result[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    (async () => {
      try {
        const [skills, notes, snippets, resources, projects] = await Promise.all([
          listSkills(),
          listNotes(),
          listSnippets(),
          listResources(),
          listProjects(),
        ]);
        const items: Result[] = [
          ...pages,
          ...skills.map((s): Result => ({
            id: s.id,
            title: s.name,
            subtitle: `Skill • ${s.category}`,
            type: "skill",
            to: `/skills/${s.id}`,
            icon: Sparkles,
          })),
          ...notes.map((n): Result => ({
            id: n.id,
            title: n.title,
            subtitle: "Note",
            type: "note",
            to: `/notes/${n.id}`,
            icon: FileText,
          })),
          ...snippets.map((s): Result => ({
            id: s.id,
            title: s.title,
            subtitle: `Snippet • ${s.language}`,
            type: "snippet",
            to: `/snippets`,
            icon: Code2,
          })),
          ...resources.map((r): Result => ({
            id: r.id,
            title: r.title,
            subtitle: `Resource • ${r.type}`,
            type: "resource",
            to: `/resources`,
            icon: BookOpen,
          })),
          ...projects.map((p): Result => ({
            id: p.id,
            title: p.name,
            subtitle: "Project",
            type: "project",
            to: `/projects`,
            icon: Target,
          })),
        ];
        setData(items);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.subtitle.toLowerCase().includes(q)
    );
  }, [data, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[640px] max-w-[92vw] surface-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-fg-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(filtered.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter") {
                const r = filtered[active];
                if (r) {
                  navigate(r.to);
                  setOpen(false);
                }
              }
            }}
            placeholder="Search skills, notes, snippets, resources..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-fg-muted text-sm">
              No results
            </div>
          )}
          {filtered.map((r, i) => {
            const Icon = r.icon;
            return (
              <button
                key={r.id + r.type}
                onClick={() => {
                  navigate(r.to);
                  setOpen(false);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm",
                  i === active
                    ? "bg-accent/10 text-fg"
                    : "text-fg-muted hover:bg-bg-elevated"
                )}
              >
                <Icon size={14} />
                <span className="flex-1 truncate font-medium">{r.title}</span>
                <span className="text-[10px] text-fg-subtle uppercase tracking-wider">
                  {r.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
