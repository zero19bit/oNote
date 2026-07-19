import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  preprocessMarkdown,
  rehypeHeadingIds,
} from "@/lib/markdownPreview";

type Mode = "edit" | "preview" | "recall";
type SaveStatus = "saved" | "saving" | "dirty";

/** Escape a string so it is safe to interpolate into HTML. The cloze
 *  replacement builds raw HTML around user content; without this, a
 *  note like `==<img src=x onerror=alert(1)>==` would inject script-y
 *  markup via `rehype-raw` into the preview tree. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  /** Title → Note lookup so wikilinks can render with the real target
   *  URL (and middle-click / right-click "open in new tab" work). */
  const [noteIndex, setNoteIndex] = useState<Map<string, Note>>(
    () => new Map()
  );

  const editorRef = useRef<RichTextEditorHandle | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = id === "new";

  // Latest state mirror — used by the unmount cleanup so the flush
  // always saves the most recent values, not the ones captured at mount.
  const stateRef = useRef({
    note,
    title,
    content,
    tags,
    skillId,
    pinned,
    archived,
  });
  stateRef.current = { note, title, content, tags, skillId, pinned, archived };

  // ---------- Data load ----------
  useEffect(() => {
    listSkills().then(setSkills).catch(() => {});
    listProjects().then(setProjects).catch(() => {});
  }, []);

  // Build the title → note index. Used by both the backlinks panel and
  // the [[wikilink]] renderer. Re-fetched after every successful save
  // so newly-created or renamed notes show up immediately.
  // Stable identity (no deps) — depending on `noteIndex` here would
  // make every save trigger a cascade of effect re-runs.
  const refreshNoteIndex = useCallback(async (): Promise<Map<string, Note>> => {
    try {
      const all = await listNotes(true);
      const m = new Map<string, Note>();
      for (const n of all) m.set(n.title.toLowerCase(), n);
      setNoteIndex(m);
      return m;
    } catch {
      return new Map();
    }
  }, []);

  useEffect(() => {
    refreshNoteIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isNew) {
          const n = await createNote({ title: "Untitled", content: "" });
          if (cancelled) return;
          navigate(`/notes/${n.id}`, { replace: true });
          return;
        }
        if (!id) return;
        const n = await getNote(id);
        if (cancelled) return;
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
        // Reset dirty state — we just loaded the canonical version from the
        // DB and we don't want the autosave loop to immediately re-write it.
        dirty.current = false;
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        setSaveStatus("saved");
        // Refresh the title→note index for this note's links too, so
        // newly-created notes show up as backlink targets. The index
        // is also used to resolve [[wikilinks]] at render time.
        const idx = await refreshNoteIndex();
        if (cancelled) return;
        setBacklinks(
          Array.from(n.content.matchAll(/\[\[([^\]]+)\]\]/g))
            .map((m) => idx.get(m[1].toLowerCase()))
            .filter((x): x is Note => !!x)
        );
      } catch (e: any) {
        if (cancelled) return;
        pushToast(e?.message ?? "Failed to load note", "error");
        navigate("/notes");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- Backlinks ----------
  // Uses the shared note index so we don't re-fetch on every save.
  // The function is still safe to call from any path (debounced autosave,
  // post-load, etc.) because it reads the latest index state.
  const loadBacklinks = useCallback((text: string) => {
    const names = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) =>
      m[1].toLowerCase()
    );
    if (!names.length) {
      setBacklinks([]);
      return;
    }
    setBacklinks(
      names
        .map((n) => noteIndex.get(n))
        .filter((x): x is Note => !!x)
    );
  }, [noteIndex]);

  // ---------- Auto-save ----------
  // Pull every dep through refs so the autosave effect can keep an
  // empty/stable dep list. Otherwise the effect re-runs (and re-arms
  // the debounce) on every state change of `noteIndex`, `loadBacklinks`
  // etc. — which means the user could type forever and never see a save.
  const pushToastRef = useRef(pushToast);
  pushToastRef.current = pushToast;
  const refreshNoteIndexRef = useRef(refreshNoteIndex);
  refreshNoteIndexRef.current = refreshNoteIndex;
  const loadBacklinksRef = useRef(loadBacklinks);
  loadBacklinksRef.current = loadBacklinks;

  const persist = useCallback(async () => {
    const s = stateRef.current;
    if (!s.note || !dirty.current) return;
    try {
      await updateNote(s.note.id, {
        title: s.title,
        content: s.content,
        tags: s.tags.split(",").map((t) => t.trim()).filter(Boolean),
        skill_id: s.skillId,
        is_pinned: s.pinned,
        is_archived: s.archived,
      } as any);
      dirty.current = false;
      setSaveStatus("saved");
      loadBacklinksRef.current(s.content);
      refreshNoteIndexRef.current();
    } catch (e: any) {
      pushToastRef.current(e?.message ?? "Save failed", "error");
      setSaveStatus("dirty");
    }
  }, []);

  useEffect(() => {
    if (!note) return;
    if (!dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      persist();
    }, 600);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [title, content, tags, skillId, pinned, archived, note, persist]);

  // Flush any pending save when the editor unmounts so navigating away
  // mid-debounce doesn't drop unsaved edits.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (dirty.current && stateRef.current.note) {
        // Fire-and-forget; Tauri invokes work fine after unmount.
        persist();
      }
    };
  }, [persist]);

  const markDirty = () => {
    dirty.current = true;
    setSaveStatus("dirty");
  };

  // ---------- Editor wiring ----------
  // The original `onEditorReady` re-ran on every parent render (because
  // it was an inline function and the RichTextEditor effect depends on
  // `onReady`). That called `ed.commands.setContent(...)` repeatedly,
  // which TipTap treats as a real edit and which resets the caret to
  // the start. We now memoize the handler to a stable reference and
  // only seed the editor from a separate effect that watches the
  // note id (so navigating to a different note still re-seeds it).
  const onEditorReady = useCallback((ed: Editor) => {
    setEditorInstance(ed);
  }, []);

  // Seed the editor with the loaded note content. Fires once on
  // initial mount and again when the user navigates to a different
  // note (`note.id` changes).
  useEffect(() => {
    if (!editorInstance || !note) return;
    editorRef.current?.setMarkdown(note.content);
    // Reset the dirty flag — seeding shouldn't count as a user edit.
    dirty.current = false;
    setSaveStatus("saved");
    // We only want to react to a note switch, not every editor state
    // change, so we deliberately don't include editorInstance in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, editorInstance]);

  // ---------- Project / color setters (don't go through autosave) ----------
  const changeProjects = async (next: string[]) => {
    const previous = projectIds;
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
      // Roll back the optimistic update so the UI matches the DB again.
      setProjectIds(previous);
      pushToast(e?.message ?? "Failed to update project", "error");
    }
  };

  const changeColor = async (next: NoteColor) => {
    const previous = color;
    setColor(next);
    if (!note) return;
    try {
      await setNoteColor(note.id, next);
    } catch (e: any) {
      setColor(previous);
      pushToast(e?.message ?? "Failed to update color", "error");
    }
  };

  // ---------- Delete ----------
  const remove = async () => {
    if (!note) return;
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote(note.id);
      pushToast("Deleted", "success");
      navigate("/notes");
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to delete", "error");
    }
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
            noteIndex={noteIndex}
          />
        ) : mode === "recall" ? (
          <RecallPane
            markdown={content}
            backlinks={backlinks}
            noteIndex={noteIndex}
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
}

// ---------- Preview / Recall panes ----------

function PreviewPane({
  markdown,
  backlinks,
  noteIndex,
}: {
  markdown: string;
  backlinks: Note[];
  noteIndex: Map<string, Note>;
}) {
  return (
    <div className="h-full overflow-y-auto p-6 bidi-plaintext max-w-3xl mx-auto">
      <div className="prose-devnotes">
        <MarkdownPreview markdown={markdown} noteIndex={noteIndex} />
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
  noteIndex,
}: {
  markdown: string;
  backlinks: Note[];
  noteIndex: Map<string, Note>;
}) {
  // Convert `==text==` cloze markers into safe HTML spans. The body
  // and the `data-cloze` attribute are both HTML-escaped so user
  // content can never inject markup back into the rehype tree.
  const transformed = useMemo(
    () =>
      markdown.replace(/==([^=]+)==/g, (_m, txt: string) => {
        const safe = escapeHtml(txt);
        return `<span class="cloze-hidden" data-cloze="${safe}">${safe}</span>`;
      }),
    [markdown]
  );
  return (
    <div className="h-full overflow-y-auto p-6 bidi-plaintext max-w-3xl mx-auto">
      <div className="mb-4 surface p-3 text-xs text-fg-muted">
        <BrainCircuit size={12} className="inline mr-1 text-accent" />
        Recall mode — <span className="cloze-revealed">revealed</span> clozes are visible.
        Use <code className="px-1 rounded bg-bg-inset">==text==</code> in your note to create clozes.
      </div>
      <div className="prose-devnotes">
        <MarkdownPreview markdown={transformed} noteIndex={noteIndex} allowRawHtml />
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

function MarkdownPreview({
  markdown,
  noteIndex,
  allowRawHtml = false,
}: {
  markdown: string;
  noteIndex: Map<string, Note>;
  allowRawHtml?: boolean;
}) {
  const navigate = useNavigate();
  const pushToast = useUI((s) => s.pushToast);
  // Run the lightweight string-level pre-processing (frontmatter
  // strip, [[wikilink]] → note: link) before handing the source to
  // react-markdown. This is purely additive — the same raw markdown
  // is still what gets written back to the database.
  const processed = preprocessMarkdown(markdown);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={
        allowRawHtml
          ? [rehypeRaw, rehypeHighlight, rehypeHeadingIds]
          : [rehypeHighlight, rehypeHeadingIds]
      }
      components={{
        a({ href, children }) {
          if (href?.startsWith("note:")) {
            // The preprocessor URL-encodes the name so titles with
            // spaces or special characters round-trip safely through
            // the markdown link parser. Decode it back here before
            // doing the case-insensitive title lookup.
            let name = href.slice("note:".length);
            try {
              name = decodeURIComponent(name);
            } catch {
              /* leave as-is if decoding fails */
            }
            // Resolve the target up-front using the shared note
            // index. This lets us render a real <Link to=...> so
            // middle-click / right-click "open in new tab" work
            // correctly. If the target isn't in the index yet (e.g.
            // just-created note), fall back to an async lookup.
            const target = noteIndex.get(name.toLowerCase());
            const to = target ? `/notes/${target.id}` : "/notes";
            const handleClick = async (e: React.MouseEvent) => {
              if (target) return; // <Link> handles it
              e.preventDefault();
              try {
                const all = await listNotes(true);
                const found = all.find(
                  (n) => n.title.toLowerCase() === name.toLowerCase()
                );
                if (found) navigate(`/notes/${found.id}`);
                else pushToast(`Note "${name}" not found`, "error");
              } catch (err: any) {
                pushToast(err?.message ?? "Failed to resolve note link", "error");
              }
            };
            return (
              <Link
                to={to}
                onClick={handleClick}
                className="wikilink"
                title={target ? `Open "${target.title}"` : `"${name}" (not found)`}
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
        // Responsive image rendering. Existing tip-tap / rehype
        // pipeline is untouched — we just constrain the image and
        // give it a subtle frame.
        img({ src, alt, title }) {
          if (!src) return null;
          return (
            <img
              src={src}
              alt={alt ?? ""}
              title={title}
              loading="lazy"
              decoding="async"
              className="prose-img"
            />
          );
        },
        // GFM task list rendering. `remark-gfm` emits
        // `<li class="task-list-item">` with a leading
        // `<input type="checkbox">` child. We pull that input out
        // and render it as a styled checkbox next to the label.
        li({ children, className, ...rest }) {
          const cls = typeof className === "string" ? className : "";
          if (!cls.includes("task-list-item")) {
            return (
              <li className={className} {...rest}>
                {children}
              </li>
            );
          }
          let checked = false;
          const restChildren: React.ReactNode[] = [];
          const arr = Array.isArray(children) ? children : [children];
          for (const child of arr) {
            if (
              child &&
              typeof child === "object" &&
              "props" in (child as any) &&
              (child as any).props?.type === "checkbox"
            ) {
              checked = !!(child as any).props?.checked;
            } else if (child !== undefined && child !== null) {
              restChildren.push(child as React.ReactNode);
            }
          }
          return (
            <li className={cls} data-checked={checked ? "true" : "false"} {...rest}>
              <span className="task-list-checkbox-wrap">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled
                  readOnly
                  className="task-list-checkbox"
                />
              </span>
              <span className="task-list-content">{restChildren}</span>
            </li>
          );
        },
      }}
    >
      {processed || "*Empty note — start typing in the editor.*"}
    </ReactMarkdown>
  );
}
