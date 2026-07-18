import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Editor } from "@tiptap/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import {
  ArrowLeft,
  Trash2,
  Pin,
  Archive,
  BrainCircuit,
  Tag as TagIcon,
  Sparkles,
  Plus,
  Link as LinkIcon,
  Eye,
  Edit3,
  X,
} from "lucide-react";
import {
  createNote,
  createProject,
  deleteNote,
  getNote,
  listNotes,
  listProjects,
  listSkills,
  Note,
  NoteColor,
  Project,
  setNoteColor,
  setNoteProjects,
  Skill,
  updateNote,
} from "@/lib/api";
import { cn, todayString } from "@/lib/utils";
import { useUI } from "@/store/ui";
import {
  NoteColorPicker,
  NoteContextMenu,
  NoteFloatingToolbar,
  ProjectMultiSelect,
  RichTextEditor,
  RichTextEditorHandle,
} from "@/components/notes";

type Mode = "edit" | "preview" | "recall";
type SaveStatus = "saved" | "saving" | "dirty";

export function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(""); // markdown source, kept in state for autosave
  const [tags, setTags] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [color, setColor] = useState<NoteColor>("default");
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<Mode>("edit");
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const editorRef = useRef<RichTextEditorHandle | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = id === "new";

  // ---------- Data load ----------
  useEffect(() => {
    listSkills().then(setSkills).catch(() => {});
    listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      if (isNew) {
        const n = await createNote({ title: "Untitled", content: "" });
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
      setColor(n.color ?? "default");
      setProjectIds(
        n.project_ids && n.project_ids.length > 0
          ? n.project_ids
          : n.project_id
            ? [n.project_id]
            : []
      );
      setPinned(n.is_pinned);
      setArchived(n.is_archived);
      // Push markdown into the editor (if it's already mounted).
      editorRef.current?.setMarkdown(n.content);
      loadBacklinks(n.content);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- Auto-save ----------
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
        loadBacklinks(content);
      } catch (e: any) {
        pushToast(e?.message ?? "Save failed", "error");
        setSaveStatus("dirty");
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, content, tags, skillId, pinned, archived, note]);

  const markDirty = () => {
    dirty.current = true;
    setSaveStatus("dirty");
  };

  // ---------- Project / color setters (don't go through autosave) ----------
  const changeProjects = async (next: string[]) => {
    setProjectIds(next);
    if (!note) return;
    try {
      await setNoteProjects(note.id, next);
      pushToast(
        next.length === 0
          ? "Unlinked from all projects"
          : `Linked to ${next.length} project${next.length === 1 ? "" : "s"}`,
        "success"
      );
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to update project", "error");
    }
  };

  const changeColor = async (next: NoteColor) => {
    setColor(next);
    if (!note) return;
    try {
      await setNoteColor(note.id, next);
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to update color", "error");
    }
  };

  // ---------- Backlinks ----------
  const loadBacklinks = async (text: string) => {
    const names = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1]);
    if (!names.length) {
      setBacklinks([]);
      return;
    }
    const all = await listNotes(true);
    setBacklinks(
      all.filter((n) => names.some((nm) => n.title.toLowerCase() === nm.toLowerCase()))
    );
  };

  // ---------- Delete ----------
  const remove = async () => {
    if (!note) return;
    if (!confirm("Delete this note?")) return;
    await deleteNote(note.id);
    pushToast("Deleted", "success");
    navigate("/notes");
  };

  // ---------- Templates ----------
  const applyTemplate = (t: string) => {
    const ts = todayString();
    const templates: Record<string, { title: string; body: string }> = {
      daily: {
        title: `${ts} — Daily Journal`,
        body: `# ${ts} — Daily Journal\n\n## What I learned today\n- \n\n## What I worked on\n- \n\n## Blockers\n- \n\n## Tomorrow\n- \n`,
      },
      standup: {
        title: `Standup — ${ts}`,
        body: `# Standup — ${ts}\n\n**Yesterday:**\n- \n\n**Today:**\n- \n\n**Blockers:**\n- \n`,
      },
      postmortem: {
        title: `Postmortem — ${ts}`,
        body: `# Postmortem — ${ts}\n\n## What happened\n\n## Root cause\n\n## What went well\n- \n\n## What didn't\n- \n\n## Action items\n- [ ] \n`,
      },
      code_review: {
        title: `Code review`,
        body: `# Code review\n\n## Summary\n\n## Strengths\n- \n\n## Issues\n- \n\n## Suggestions\n- \n`,
      },
      book: {
        title: `Book notes`,
        body: `# Book notes\n\n## Key ideas\n- \n\n## Quotes\n> \n\n## How I'll apply this\n- \n`,
      },
    };
    const picked = templates[t];
    if (!picked) return;
    if (title === "" || title === "Untitled") setTitle(picked.title);
    setContent(picked.body);
    editorRef.current?.setMarkdown(picked.body);
    setShowTemplates(false);
    markDirty();
  };

  // ---------- Render ----------
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
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          placeholder="Untitled"
          dir="auto"
          className="flex-1 bg-transparent text-lg font-semibold outline-none bidi-plaintext"
        />
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          {saveStatus === "saving" && <span className="animate-pulse-soft">Saving…</span>}
          {saveStatus === "saved" && <span className="text-green-400">● Saved</span>}
          {saveStatus === "dirty" && <span className="text-amber-400">● Unsaved</span>}
        </div>
        <NoteColorPicker value={color} onChange={changeColor} />
        <button
          onClick={() => {
            setPinned((v) => !v);
            markDirty();
          }}
          className={cn("btn-ghost", pinned && "text-accent")}
          title="Pin"
        >
          <Pin size={14} />
        </button>
        <button
          onClick={() => {
            setArchived((v) => !v);
            markDirty();
          }}
          className={cn("btn-ghost", archived && "text-brand-amber")}
          title="Archive"
        >
          <Archive size={14} />
        </button>
        <button onClick={remove} className="btn-ghost text-red-400" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Meta row */}
      <div className="border-b border-border bg-bg-surface/20 px-4 py-2 flex items-center gap-4 text-xs flex-wrap">
        <label className="flex items-center gap-1.5">
          <TagIcon size={12} className="text-fg-muted" />
          <span className="text-[10px] uppercase tracking-wider text-fg-muted">Tags</span>
          <input
            value={tags}
            onChange={(e) => {
              setTags(e.target.value);
              markDirty();
            }}
            placeholder="comma, separated"
            className="bg-transparent outline-none w-44"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-fg-muted" />
          <span className="text-[10px] uppercase tracking-wider text-fg-muted">Skill</span>
          <select
            value={skillId ?? ""}
            onChange={(e) => {
              setSkillId(e.target.value || null);
              markDirty();
            }}
            className="bg-transparent outline-none cursor-pointer"
            title="Link this note to a skill"
          >
            <option value="">— none —</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <ProjectMultiSelect
          available={projects}
          selected={projectIds}
          onChange={changeProjects}
          disabled={!note}
          onCreateProject={async (name) => {
            const p = await createProject({ name } as any);
            setProjects((prev) => [p, ...prev]);
            return p;
          }}
        />
        <div className="ml-auto flex items-center gap-1">
          {(["edit", "preview", "recall"] as Mode[]).map((m) => (
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
              <span className="inline-flex items-center gap-1">
                {m === "edit" && <Edit3 size={10} />}
                {m === "preview" && <Eye size={10} />}
                {m === "recall" && <BrainCircuit size={10} />}
                {m}
              </span>
            </button>
          ))}
          <button onClick={() => setShowTemplates((v) => !v)} className="btn-ghost ml-1">
            <Plus size={12} /> Template
          </button>
        </div>
      </div>

      {showTemplates && (
        <div className="border-b border-border bg-bg-elevated px-4 py-2 flex gap-2 text-xs flex-wrap">
          {["daily", "standup", "postmortem", "code_review", "book"].map((t) => (
            <button
              key={t}
              onClick={() => applyTemplate(t)}
              className="chip cursor-pointer hover:bg-accent/20"
            >
              {t.replace("_", " ")}
            </button>
          ))}
          <button
            onClick={() => setShowTemplates(false)}
            className="ml-auto p-1 rounded hover:bg-bg-elevated text-fg-muted"
            title="Close templates"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden">
        {mode === "preview" ? (
          <PreviewPane
            markdown={content}
            backlinks={backlinks}
          />
        ) : mode === "recall" ? (
          <RecallPane
            markdown={content}
            backlinks={backlinks}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-6">
              <RichTextEditor
                ref={editorRef}
                editable
                onReady={onEditorReady}
                onChange={(md) => {
                  setContent(md);
                  markDirty();
                }}
              />
            </div>
            <NoteFloatingToolbar editor={editorInstance} />
            <NoteContextMenu editor={editorInstance} />
          </div>
        )}
      </div>
    </div>
  );

  function onEditorReady(ed: Editor) {
    setEditorInstance(ed);
    // Seed the editor with the loaded note content. Note: setContent on
    // a freshly-created editor may not fire onUpdate, so we don't have
    // to manage dirty here.
    try {
      const storage = ed.storage as unknown as {
        markdown?: { parse?: (md: string) => unknown };
      };
      const parsed = storage.markdown?.parse?.(note?.content ?? "");
      ed.commands.setContent(parsed ?? note?.content ?? "");
    } catch {
      /* ignore */
    }
  }
}

// ---------- Preview / Recall panes ----------

function PreviewPane({
  markdown,
  backlinks,
}: {
  markdown: string;
  backlinks: Note[];
}) {
  return (
    <div className="h-full overflow-y-auto p-6 bidi-plaintext max-w-3xl mx-auto">
      <div className="prose-devnotes">
        <MarkdownPreview markdown={markdown} />
      </div>
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
  );
}

function RecallPane({
  markdown,
  backlinks,
}: {
  markdown: string;
  backlinks: Note[];
}) {
  const transformed = markdown.replace(
    /==([^=]+)==/g,
    '<span class="cloze-hidden" data-cloze="$1">$1</span>'
  );
  return (
    <div className="h-full overflow-y-auto p-6 bidi-plaintext max-w-3xl mx-auto">
      <div className="mb-4 surface p-3 text-xs text-fg-muted">
        <BrainCircuit size={12} className="inline mr-1 text-accent" />
        Recall mode — <span className="cloze-revealed">revealed</span> clozes are visible.
        Use <code className="px-1 rounded bg-bg-inset">==text==</code> in your note to create clozes.
      </div>
      <div className="prose-devnotes">
        <MarkdownPreview markdown={transformed} />
      </div>
      {backlinks.length > 0 && (
        <div className="mt-12 pt-4 border-t border-border">
          <div className="text-xs text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1">
            <LinkIcon size={11} /> Backlinks
          </div>
          <div className="space-y-1">
            {backlinks.map((b) => (
              <Link key={b.id} to={`/notes/${b.id}`} className="block text-sm text-accent hover:underline">
                {b.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const navigate = useNavigate();
  const pushToast = useUI((s) => s.pushToast);
  return (
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
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {markdown || "*Empty note — start typing in the editor.*"}
    </ReactMarkdown>
  );
}
