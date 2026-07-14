import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Plus,
  Search,
  Trash2,
  Edit3,
  Filter,
  Tag as TagIcon,
  BrainCircuit,
  Clock,
  Code2,
  StickyNote,
} from "lucide-react";
import { listSkills, deleteSkill, Skill } from "@/lib/api";
import { cn, levelLabel, levelColor, relativeTime } from "@/lib/utils";
import { useUI } from "@/store/ui";

const CATEGORIES = ["language", "framework", "tool", "concept", "domain", "platform"];

const COLORS = [
  "#22d3ee", "#a78bfa", "#f472b6", "#34d399",
  "#fbbf24", "#f87171", "#60a5fa", "#fb923c",
];

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Skill> | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    try {
      setSkills(await listSkills());
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to load", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Listen to "new" event from topbar
  useEffect(() => {
    const handler = () => setEditing({ name: "", category: "language", level: 1, color: "#22d3ee", description: "", tags: [] });
    window.addEventListener("skills:new", handler);
    return () => window.removeEventListener("skills:new", handler);
  }, []);

  const filtered = skills.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (q && !`${s.name} ${s.description} ${s.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <Search size={14} className="text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-search-input
            placeholder="Search skills, tags, descriptions..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <select
          value={categoryFilter ?? ""}
          onChange={(e) => setCategoryFilter(e.target.value || null)}
          className="input w-auto"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            setEditing({ name: "", category: "language", level: 1, color: "#22d3ee", description: "", tags: [] })
          }
          className="btn-primary"
        >
          <Plus size={14} />
          New skill
        </button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setCategoryFilter(null)}
          className={cn("chip cursor-pointer", !categoryFilter && "bg-accent/20 border-accent/50 text-accent")}
        >
          All ({skills.length})
        </button>
        {CATEGORIES.map((c) => {
          const count = skills.filter((s) => s.category === c).length;
          if (count === 0) return null;
          return (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={cn(
                "chip cursor-pointer",
                categoryFilter === c && "bg-accent/20 border-accent/50 text-accent"
              )}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <Sparkles size={32} className="text-fg-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No skills yet</h3>
          <p className="text-sm text-fg-muted mb-4">
            Add a language, framework, tool, or any tech concept to start tracking your growth.
          </p>
          <button
            onClick={() =>
              setEditing({ name: "", category: "language", level: 1, color: "#22d3ee", description: "", tags: [] })
            }
            className="btn-primary"
          >
            <Plus size={14} />
            Add your first skill
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <SkillCard
              key={s.id}
              skill={s}
              onEdit={() => setEditing(s)}
              onDelete={async () => {
                if (!confirm(`Delete "${s.name}"?`)) return;
                await deleteSkill(s.id);
                pushToast("Deleted", "success");
                load();
                window.dispatchEvent(new CustomEvent("achievement:recheck"));
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <SkillEditor
          skill={editing}
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

function SkillCard({
  skill,
  onEdit,
  onDelete,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDue =
    !skill.next_review_at || new Date(skill.next_review_at) <= new Date();
  return (
    <div className="surface p-4 hover:border-border-strong transition-colors group relative">
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-bg-base font-bold text-lg shrink-0"
          style={{ background: skill.color }}
        >
          {skill.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to={`/skills/${skill.id}`}
            className="text-base font-semibold hover:text-accent block truncate"
          >
            {skill.name}
          </Link>
          <div className="text-[11px] text-fg-muted uppercase tracking-wider">
            {skill.category}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
          <button onClick={onEdit} className="p-1 hover:bg-bg-elevated rounded">
            <Edit3 size={12} className="text-fg-muted" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-bg-elevated rounded">
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      </div>

      <p className="text-sm text-fg-muted line-clamp-2 mb-3 min-h-[2.5rem]">
        {skill.description || "No description yet."}
      </p>

      {/* Level */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                background: i <= skill.level ? levelColor(skill.level) : "#1f2937",
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-fg-muted uppercase">
          {levelLabel(skill.level)}
        </span>
      </div>

      {/* Tags */}
      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {skill.tags.slice(0, 4).map((t) => (
            <span key={t} className="chip">
              <TagIcon size={9} />
              {t}
            </span>
          ))}
          {skill.tags.length > 4 && (
            <span className="chip">+{skill.tags.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          {isDue ? (
            <span className="text-accent flex items-center gap-1">
              <BrainCircuit size={11} /> due
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock size={11} /> in{" "}
              {Math.max(
                0,
                Math.ceil(
                  (new Date(skill.next_review_at!).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              )}
              d
            </span>
          )}
        </div>
        <div>{skill.last_reviewed_at ? `Last: ${relativeTime(skill.last_reviewed_at)}` : "Never reviewed"}</div>
      </div>
    </div>
  );
}

function SkillEditor({
  skill,
  onClose,
  onSaved,
}: {
  skill: Partial<Skill>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(skill.name ?? "");
  const [category, setCategory] = useState(skill.category ?? "language");
  const [level, setLevel] = useState(skill.level ?? 1);
  const [description, setDescription] = useState(skill.description ?? "");
  const [color, setColor] = useState(skill.color ?? "#22d3ee");
  const [tags, setTags] = useState((skill.tags ?? []).join(", "));
  const pushToast = useUI((s) => s.pushToast);
  const isNew = !skill.id;

  const save = async () => {
    if (!name.trim()) {
      pushToast("Name is required", "error");
      return;
    }
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (isNew) {
        const { createSkill } = await import("@/lib/api");
        await createSkill({ name, category, level, description, color, tags: tagList });
      } else {
        const { updateSkill } = await import("@/lib/api");
        await updateSkill(skill.id!, { name, category, level, description, color, tags: tagList });
      }
      pushToast(isNew ? "Skill created" : "Saved", "success");
      onSaved();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] surface-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold">{isNew ? "New skill" : "Edit skill"}</div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg text-sm">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Rust, Kubernetes, Burp Suite, Neural Nets..."
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-fg-muted uppercase tracking-wider mb-1 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-fg-muted uppercase tracking-wider mb-1 block">Level</label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    onClick={() => setLevel(i)}
                    className="flex-1 h-full rounded-md border"
                    style={{
                      background: i <= level ? levelColor(i) : "transparent",
                      borderColor: i <= level ? levelColor(i) : "#1f2937",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider mb-1 block">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-md border-2 transition-all"
                  style={{ background: c, borderColor: color === c ? "#fff" : "transparent" }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this skill? When did you start? What's your goal?"
              className="input min-h-[80px] resize-y"
            />
          </div>
          <div>
            <label className="text-xs text-fg-muted uppercase tracking-wider mb-1 block">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="backend, async, web"
              className="input"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary">
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
