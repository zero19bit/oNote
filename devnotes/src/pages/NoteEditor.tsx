import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import {
  ArrowLeft,
  Save,
  Trash2,
  Pin,
  Archive,
  Eye,
  Edit3,
  BrainCircuit,
  Tag as TagIcon,
  Sparkles,
  Plus,
  Link as LinkIcon,
} from "lucide-react";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  listSkills,
  Note,
  Skill,
  updateNote,
} from "@/lib/api";
import { cn, relativeTime, todayString } from "@/lib/utils";
import { useUI } from "@/store/ui";

type Mode = "edit" | "preview" | "split" | "recall";

export function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mode, setMode] = useState<Mode>("split");
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "dirty">("saved");
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = id === "new";

  useEffect(() => {
    listSkills().then(setSkills).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      if (isNew) {
        const n = await createNote({
          title: "Untitled",
          content: "",
        });
        navigate(`/notes/${n.id}`, { replace: true });
        return;
      }
      if (!id) return;
      const n = await getNote(id);
      if (!n) {
        pushToast("Note not found", "error");
        navigate("/notes");
        return;
      }
      setNote(n);
      setTitle(n.title);
      setContent(n.content);
      setTags(n.tags.join(", "));
      setSkillId(n.skill_id);
      setPinned(n.is_pinned);
      setArchived(n.is_archived);
    })();
  }, [id]);

  // Auto-save with debounce
  useEffect(() => {
    if (!note) return;
    if (!dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = window.setTimeout(async () => {
      try {
        await updateNote(note.id, {
          title,
          content,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          skill_id: skillId,
          is_pinned: pinned,
          is_archived: archived,
        } as any);
        setSaveStatus("saved");
        dirty.current = false;
        // Reload backlinks
        loadBacklinks(content);
      } catch (e: any) {
        pushToast(e?.message ?? "Save failed", "error");
        setSaveStatus("dirty");
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, content, tags, skillId, pinned, archived]);

  const markDirty = (setter: any) => (v: any) => {
    dirty.current = true;
    setter(v);
  };

  const loadBacklinks = async (text: string) => {
    const names = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1]);
    if (!names.length) {
      setBacklinks([]);
      return;
    }
    const all = await listNotes(true);
    setBacklinks(all.filter((n) => names.some((nm) => n.title.toLowerCase() === nm.toLowerCase())));
  };

  // Apply [[wikilink]] -> link, plus cloze support
  const transformedContent = useMemo(() => {
    if (mode !== "recall") return content;
    return content.replace(/==([^=]+)==/g, '<span class="cloze-hidden" data-cloze="$1">$1</span>');
  }, [content, mode]);

  const remove = async () => {
    if (!note) return;
    if (!confirm("Delete this note?")) return;
    await deleteNote(note.id);
    pushToast("Deleted", "success");
    navigate("/notes");
  };

  const applyTemplate = (t: string) => {
    const ts = todayString();
    const templates: Record<string, string> = {
      daily: `# ${ts} — Daily Journal\n\n## What I learned today\n- \n\n## What I worked on\n- \n\n## Blockers\n- \n\n## Tomorrow\n- \n`,
      standup: `# Standup — ${ts}\n\n**Yesterday:**\n- \n\n**Today:**\n- \n\n**Blockers:**\n- \n`,
      postmortem: `# Postmortem — ${ts}\n\n## What happened\n\n## Root cause\n\n## What went well\n- \n\n## What didn't\n- \n\n## Action items\n- [ ] \n`,
      code_review: `# Code review — {date}\n\n## Summary\n\n## Strengths\n- \n\n## Issues\n- \n\n## Suggestions\n- \n`,
      book: `# Book notes — \n\n## Key ideas\n- \n\n## Quotes\n> \n\n## How I'll apply this\n- \n`,
    };
    setContent((templates[t] ?? ""));
    setTitle((prev) => (prev === "Untitled" ? t.charAt(0).toUpperCase() + t.slice(1) : prev));
    setShowTemplates(false);
    dirty.current = true;
    setSaveStatus("dirty");
  };

  if (!note) {
    return <div className="p-8 text-fg-muted text-sm">Loading note...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-bg-surface/40 backdrop-blur px-4 py-2.5 flex items-center gap-2">
        <button onClick={() => navigate("/notes")} className="btn-ghost text-xs">
          <ArrowLeft size={14} /> Notes
        </button>
        <input
          value={title}
          onChange={(e) => markDirty(setTitle)(e.target.value)}
          placeholder="Untitled"
          dir="auto"
          className="flex-1 bg-transparent text-lg font-semibold outline-none bidi-plaintext"
        />
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          {saveStatus === "saving" && <span className="animate-pulse-soft">Saving…</span>}
          {saveStatus === "saved" && <span className="text-green-400">● Saved</span>}
          {saveStatus === "dirty" && <span className="text-amber-400">● Unsaved</span>}
        </div>
        <button onClick={() => setPinned((v) => { dirty.current = true; return !v; })} className={cn("btn-ghost", pinned && "text-accent")}>
          <Pin size={14} />
        </button>
        <button onClick={() => setArchived((v) => { dirty.current = true; return !v; })} className={cn("btn-ghost", archived && "text-brand-amber")}>
          <Archive size={14} />
        </button>
        <button onClick={remove} className="btn-ghost text-red-400">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Meta row */}
      <div className="border-b border-border bg-bg-surface/20 px-4 py-2 flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <TagIcon size={12} className="text-fg-muted" />
          <input
            value={tags}
            onChange={(e) => markDirty(setTags)(e.target.value)}
            placeholder="comma, separated, tags"
            className="bg-transparent outline-none w-48"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-fg-muted" />
          <select
            value={skillId ?? ""}
            onChange={(e) => markDirty(setSkillId)(e.target.value || null)}
            className="bg-transparent outline-none cursor-pointer"
          >
            <option value="">— no skill —</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {(["edit", "split", "preview", "recall"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-2 py-1 rounded text-[11px] uppercase tracking-wider",
                mode === m
                  ? "bg-accent/20 text-accent"
                  : "text-fg-muted hover:bg-bg-elevated"
              )}
            >
              {m}
            </button>
          ))}
          <button onClick={() => setShowTemplates((v) => !v)} className="btn-ghost ml-1">
            <Plus size={12} /> Template
          </button>
        </div>
      </div>

      {showTemplates && (
        <div className="border-b border-border bg-bg-elevated px-4 py-2 flex gap-2 text-xs">
          {["daily", "standup", "postmortem", "code_review", "book"].map((t) => (
            <button key={t} onClick={() => applyTemplate(t)} className="chip cursor-pointer hover:bg-accent/20">
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {/* Editor + preview */}
      <div className={cn("flex-1 overflow-hidden", mode === "split" ? "grid grid-cols-2" : "")}>
        {(mode === "edit" || mode === "split") && (
          <textarea
            value={content}
            onChange={(e) => markDirty(setContent)(e.target.value)}
            dir="auto"
            className={cn(
              "w-full h-full bg-bg-base p-6 outline-none font-mono text-sm resize-none bidi-plaintext",
              mode === "split" && "border-r border-border"
            )}
            placeholder="# Start writing...&#10;&#10;Use ==highlighted text== for recall cloze.&#10;Link to other notes with [[Note Title]].&#10;Use ```language for code blocks."
          />
        )}
        {(mode === "preview" || mode === "split" || mode === "recall") && (
          <div dir="auto" className="h-full overflow-y-auto p-6 prose-devnotes bidi-plaintext">
            {mode === "recall" && (
              <div className="mb-4 surface p-3 text-xs text-fg-muted">
                <BrainCircuit size={12} className="inline mr-1 text-accent" />
                Recall mode — click <span className="cloze-revealed">revealed</span> clozes are visible.
                Use <code className="px-1 rounded bg-bg-inset">==text==</code> in your note to create clozes.
              </div>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={{
                a({ href, children }) {
                  if (href?.startsWith("note:")) {
                    const name = href.replace("note:", "");
                    return (
                      <Link
                        to={`/notes`}
                        onClick={async () => {
                          const all = await listNotes(true);
                          const target = all.find(
                            (n) => n.title.toLowerCase() === name.toLowerCase()
                          );
                          if (target) navigate(`/notes/${target.id}`);
                          else pushToast(`Note "${name}" not found`, "error");
                        }}
                        className="wikilink"
                      >
                        {children}
                      </Link>
                    );
                  }
                  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
                },
              }}
            >
              {transformedContent || "*Empty note — start typing in the editor.*"}
            </ReactMarkdown>
            {backlinks.length > 0 && (
              <div className="mt-12 pt-4 border-t border-border">
                <div className="text-xs text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <LinkIcon size={11} /> Backlinks
                </div>
                <div className="space-y-1">
                  {backlinks.map((b) => (
                    <Link
                      key={b.id}
                      to={`/notes/${b.id}`}
                      className="block text-sm text-accent hover:underline"
                    >
                      {b.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
