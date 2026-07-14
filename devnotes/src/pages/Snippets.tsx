import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Copy,
  Code2,
  Tag as TagIcon,
  Sparkles,
  Hash,
  Check,
} from "lucide-react";
import {
  listSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  bumpUsage,
  listSkills,
  Snippet,
  Skill,
} from "@/lib/api";
import { copyToClipboard, relativeTime, cn } from "@/lib/utils";
import { useUI } from "@/store/ui";

const LANGS = [
  "plaintext", "typescript", "javascript", "python", "rust", "go",
  "c", "cpp", "csharp", "java", "kotlin", "swift", "ruby", "php",
  "bash", "shell", "powershell", "sql", "graphql", "yaml", "json",
  "html", "css", "scss", "dockerfile", "makefile", "markdown",
  "hcl", "terraform", "nginx", "lua", "r", "matlab", "scala",
];

export function Snippets() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Snippet> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    try {
      setSnippets(await listSnippets());
      setSkills(await listSkills());
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to load", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () =>
      setEditing({ title: "", language: "typescript", code: "", tags: [] });
    window.addEventListener("snippets:new", handler);
    return () => window.removeEventListener("snippets:new", handler);
  }, []);

  const filtered = useMemo(() => {
    return snippets
      .filter((s) => (lang ? s.language === lang : true))
      .filter((s) => {
        if (!q) return true;
        const hay = `${s.title} ${s.description} ${s.tags.join(" ")} ${s.code}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  }, [snippets, q, lang]);

  const allLangs = useMemo(() => {
    const s = new Set(snippets.map((x) => x.language));
    return Array.from(s).sort();
  }, [snippets]);

  const copy = async (s: Snippet) => {
    await copyToClipboard(s.code);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 1500);
    bumpUsage(s.id).then(load);
    pushToast(`Copied "${s.title}" to clipboard`, "success");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <Search size={14} className="text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-search-input
            placeholder="Search snippets (title, tags, code)..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <select value={lang ?? ""} onChange={(e) => setLang(e.target.value || null)} className="input w-auto">
          <option value="">All languages</option>
          {allLangs.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={() => setEditing({ title: "", language: "typescript", code: "", tags: [] })}
          className="btn-primary"
        >
          <Plus size={14} /> New snippet
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <Code2 size={32} className="text-fg-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No snippets yet</h3>
          <p className="text-sm text-fg-muted mb-4">
            Save your most-used code here for one-click access.
          </p>
          <button
            onClick={() => setEditing({ title: "", language: "typescript", code: "", tags: [] })}
            className="btn-primary"
          >
            <Plus size={14} /> Create your first snippet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((s) => (
            <div key={s.id} className="surface p-4 hover:border-border-strong group">
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{s.title}</div>
                  {s.description && (
                    <div className="text-xs text-fg-muted line-clamp-1">{s.description}</div>
                  )}
                </div>
                <span className="chip uppercase tracking-wider">{s.language}</span>
              </div>

              <pre className="text-xs bg-bg-inset p-3 rounded-md font-mono overflow-x-auto max-h-40 overflow-y-auto">
                <code>{s.code}</code>
              </pre>

              {s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.tags.slice(0, 4).map((t) => (
                    <span key={t} className="chip">
                      <Hash size={9} />
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 mt-2 border-t border-border">
                <div>
                  {s.usage_count > 0 ? `Used ${s.usage_count}×` : "Never used"} • {relativeTime(s.updated_at)}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copy(s)}
                    className={cn(
                      "p-1.5 rounded-md hover:bg-bg-elevated flex items-center gap-1",
                      copiedId === s.id && "text-green-400"
                    )}
                  >
                    {copiedId === s.id ? <Check size={12} /> : <Copy size={12} />}
                    <span className="text-[10px]">{copiedId === s.id ? "Copied" : "Copy"}</span>
                  </button>
                  <button onClick={() => setEditing(s)} className="p-1.5 hover:bg-bg-elevated rounded">
                    <Edit3 size={12} className="text-fg-muted" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${s.title}"?`)) return;
                      await deleteSnippet(s.id);
                      pushToast("Deleted", "success");
                      load();
                    }}
                    className="p-1.5 hover:bg-bg-elevated rounded"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SnippetEditor
          snippet={editing}
          skills={skills}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            window.dispatchEvent(new CustomEvent("achievement:recheck"));
          }}
        />
      )}
    </div>
  );
}

function SnippetEditor({
  snippet,
  skills,
  onClose,
  onSaved,
}: {
  snippet: Partial<Snippet>;
  skills: Skill[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(snippet.title ?? "");
  const [description, setDescription] = useState(snippet.description ?? "");
  const [language, setLanguage] = useState(snippet.language ?? "typescript");
  const [code, setCode] = useState(snippet.code ?? "");
  const [tags, setTags] = useState((snippet.tags ?? []).join(", "));
  const [skillId, setSkillId] = useState<string | null>(snippet.skill_id ?? null);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = !snippet.id;

  const save = async () => {
    if (!title.trim() || !code.trim()) {
      pushToast("Title and code are required", "error");
      return;
    }
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (isNew) {
        await createSnippet({ title, description, language, code, tags: tagList, skill_id: skillId } as any);
      } else {
        await updateSnippet(snippet.id!, { title, description, language, code, tags: tagList, skill_id: skillId } as any);
      }
      pushToast(isNew ? "Snippet saved" : "Updated", "success");
      onSaved();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[720px] max-w-[95vw] max-h-[90vh] surface-elevated flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border font-semibold">
          {isNew ? "New snippet" : "Edit snippet"}
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-fg-muted uppercase mb-1 block">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="input" placeholder="e.g. Debounce hook" />
            </div>
            <div>
              <label className="text-xs text-fg-muted uppercase mb-1 block">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input">
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-fg-muted uppercase mb-1 block">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-fg-muted uppercase mb-1 block">Tags</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" placeholder="react, hook, async" />
            </div>
            <div>
              <label className="text-xs text-fg-muted uppercase mb-1 block">Skill (optional)</label>
              <select value={skillId ?? ""} onChange={(e) => setSkillId(e.target.value || null)} className="input">
                <option value="">— none —</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-fg-muted uppercase mb-1 block">Code</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input font-mono text-xs min-h-[280px] resize-y"
              placeholder="// paste your code here"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary">
            {isNew ? "Save" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
