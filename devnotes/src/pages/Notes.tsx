import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  Target,
  Eye,
  Edit3,
} from "lucide-react";
import {
  listNotes,
  listProjects,
  createNote,
  updateNote,
  deleteNote,
  Note,
  NOTE_COLORS,
  Project,
} from "@/lib/api";
import { cn, relativeTime, truncate } from "@/lib/utils";
import { useUI } from "@/store/ui";

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    try {
      const [ns, ps] = await Promise.all([listNotes(true), listProjects()]);
      setNotes(ns);
      setProjects(ps);
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to load", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = async () => {
      const n = await createNote({ title: "Untitled", content: "" });
      navigate(`/notes/${n.id}`);
    };
    window.addEventListener("notes:new", handler);
    return () => window.removeEventListener("notes:new", handler);
  }, [navigate]);

  const allTags = useMemo(() => {
    const t = new Set<string>();
    notes.forEach((n) => n.tags.forEach((x) => t.add(x)));
    return Array.from(t).sort();
  }, [notes]);

  /** Build a quick lookup so we can render project names without an
   *  extra fetch. Keys are project ids. */
  const projectById = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return notes
      .filter((n) => (showArchived ? true : !n.is_archived))
      .filter((n) => (tag ? n.tags.includes(tag) : true))
      .filter((n) => {
        if (!projectFilter) return true;
        // Match either legacy project_id or the new project_ids array.
        const ids =
          n.project_ids && n.project_ids.length > 0
            ? n.project_ids
            : n.project_id
              ? [n.project_id]
              : [];
        return ids.includes(projectFilter);
      })
      .filter((n) => {
        if (!q) return true;
        const hay = `${n.title} ${n.content} ${n.tags.join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return a.updated_at < b.updated_at ? 1 : -1;
      });
  }, [notes, q, tag, projectFilter, showArchived]);

  const togglePin = async (n: Note) => {
    await updateNote(n.id, { ...n, is_pinned: !n.is_pinned } as any);
    load();
  };
  const toggleArchive = async (n: Note) => {
    await updateNote(n.id, { ...n, is_archived: !n.is_archived } as any);
    load();
  };
  const remove = async (n: Note) => {
    if (!confirm(`Delete "${n.title}"?`)) return;
    await deleteNote(n.id);
    pushToast("Deleted", "success");
    load();
  };

  /** Get the bg class for a note based on its color tag. */
  const colorClass = (id: string) =>
    (NOTE_COLORS.find((c) => c.id === id) ?? NOTE_COLORS[0]).bg;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <Search size={14} className="text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-search-input
            placeholder="Search notes..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={async () => {
            const n = await createNote({ title: "Untitled", content: "" });
            navigate(`/notes/${n.id}`);
          }}
          className="btn-primary"
        >
          <Plus size={14} /> New note
        </button>
      </div>

      {(allTags.length > 0 || projects.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-4 items-center">
          {allTags.length > 0 && (
            <>
              <button
                onClick={() => setTag(null)}
                className={cn("chip cursor-pointer", !tag && "bg-accent/20 border-accent/50 text-accent")}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className={cn(
                    "chip cursor-pointer",
                    tag === t && "bg-accent/20 border-accent/50 text-accent"
                  )}
                >
                  #{t}
                </button>
              ))}
            </>
          )}

          {projects.length > 0 && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
              <Target size={10} className="text-fg-muted" />
              <button
                onClick={() => setProjectFilter(null)}
                className={cn(
                  "chip cursor-pointer",
                  !projectFilter && "bg-accent/20 border-accent/50 text-accent"
                )}
              >
                Any project
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjectFilter(p.id)}
                  className={cn(
                    "chip cursor-pointer",
                    projectFilter === p.id && "bg-accent/20 border-accent/50 text-accent"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "chip cursor-pointer ml-auto",
              showArchived && "bg-brand-amber/20 border-brand-amber/50 text-brand-amber"
            )}
          >
            <Archive size={10} /> Archived
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <h3 className="text-lg font-semibold mb-1">No notes found</h3>
          <p className="text-sm text-fg-muted mb-4">
            {notes.length === 0
              ? "Capture ideas, code lessons, postmortems, daily learnings..."
              : "Try a different search or tag."}
          </p>
          <button
            onClick={async () => {
              const n = await createNote({ title: "Untitled", content: "" });
              navigate(`/notes/${n.id}`);
            }}
            className="btn-primary"
          >
            <Plus size={14} /> Create your first note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((n) => {
            const projectIds =
              n.project_ids && n.project_ids.length > 0
                ? n.project_ids
                : n.project_id
                  ? [n.project_id]
                  : [];
            const projectNames = projectIds
              .map((id) => projectById.get(id)?.name)
              .filter((x): x is string => !!x);
            return (
              <div
                key={n.id}
                className={cn(
                  "surface p-4 hover:border-border-strong group relative",
                  colorClass(n.color)
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  {n.is_pinned && <Pin size={12} className="text-accent mt-0.5" />}
                  <Link
                    to={`/notes/${n.id}`}
                    dir="auto"
                    className="font-semibold flex-1 hover:text-accent line-clamp-1"
                  >
                    {n.title || "Untitled"}
                  </Link>
                </div>
                <Link to={`/notes/${n.id}`}>
                  <p
                    dir="auto"
                    className="text-sm text-fg-muted line-clamp-3 mb-3 min-h-[3rem] bidi-plaintext"
                  >
                    {truncate(
                      n.content.replace(/^#+ /gm, "").replace(/[*`_]/g, ""),
                      180
                    ) || "Empty note"}
                  </p>
                </Link>
                {(n.tags.length > 0 || projectNames.length > 0) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {projectNames.map((name) => (
                      <span
                        key={name}
                        className="chip bg-accent/10 border-accent/30 text-accent"
                      >
                        <Target size={10} /> {name}
                      </span>
                    ))}
                    {n.tags.slice(0, 3).map((t) => (
                      <span key={t} className="chip">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 border-t border-border">
                  <span>{relativeTime(n.updated_at)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => togglePin(n)}
                      className="p-1 hover:bg-bg-elevated rounded"
                    >
                      <Pin
                        size={12}
                        className={n.is_pinned ? "text-accent" : "text-fg-muted"}
                      />
                    </button>
                    <button
                      onClick={() => toggleArchive(n)}
                      className="p-1 hover:bg-bg-elevated rounded"
                    >
                      <Archive
                        size={12}
                        className={
                          n.is_archived ? "text-brand-amber" : "text-fg-muted"
                        }
                      />
                    </button>
                    <button
                      onClick={() => remove(n)}
                      className="p-1 hover:bg-bg-elevated rounded"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
