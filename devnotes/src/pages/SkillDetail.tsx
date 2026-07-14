import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Trash2,
  Code2,
  StickyNote,
  BookOpen,
  BrainCircuit,
  Tag as TagIcon,
  Clock,
  TrendingUp,
} from "lucide-react";
import { getSkill, listNotes, listSnippets, listResources, Skill, Note, Snippet, Resource, createNote, updateSkill } from "@/lib/api";
import { cn, levelColor, levelLabel, relativeTime } from "@/lib/utils";
import { useUI } from "@/store/ui";

export function SkillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [tab, setTab] = useState<"notes" | "snippets" | "resources" | "review">("notes");
  const [editing, setEditing] = useState(false);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    if (!id) return;
    const s = await getSkill(id);
    setSkill(s);
    if (s) {
      const [n, sn, r] = await Promise.all([
        listNotes(),
        listSnippets(),
        listResources(),
      ]);
      setNotes(n.filter((x) => x.skill_id === s.id));
      setSnippets(sn.filter((x) => x.skill_id === s.id));
      setResources(r.filter((x) => x.skill_id === s.id));
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const createNewNote = async () => {
    if (!skill) return;
    const n = await createNote({
      title: "Untitled",
      content: `# ${skill.name}\n\n`,
      skill_id: skill.id,
      tags: skill.tags,
    });
    navigate(`/notes/${n.id}`);
  };

  if (!skill) {
    return <div className="p-8 text-fg-muted text-sm">Loading skill...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button
        onClick={() => navigate("/skills")}
        className="btn-ghost text-xs mb-4 -ml-2"
      >
        <ArrowLeft size={14} /> All skills
      </button>

      <div className="surface-elevated p-6 mb-4 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-1"
          style={{ background: skill.color }}
        />
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-bg-base font-bold text-2xl shrink-0"
            style={{ background: skill.color }}
          >
            {skill.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold">{skill.name}</h2>
            <div className="text-xs text-fg-muted uppercase tracking-wider mt-0.5">
              {skill.category}
            </div>
            <p className="text-sm text-fg-muted mt-2">{skill.description || "No description yet."}</p>
            {skill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {skill.tags.map((t) => (
                  <span key={t} className="chip">
                    <TagIcon size={9} /> {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="btn-outline">
            <Edit3 size={14} /> Edit
          </button>
        </div>

        {/* Level + review state */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Level" value={levelLabel(skill.level)} accent={levelColor(skill.level)} />
          <Stat label="Repetitions" value={skill.repetitions} />
          <Stat
            label="Interval"
            value={`${skill.interval_days}d`}
          />
          <Stat
            label="Ease"
            value={skill.ease.toFixed(2)}
            accent={skill.ease >= 2.5 ? "text-green-400" : "text-orange-400"}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {[
          { k: "notes" as const, label: `Notes (${notes.length})`, icon: StickyNote },
          { k: "snippets" as const, label: `Snippets (${snippets.length})`, icon: Code2 },
          { k: "resources" as const, label: `Resources (${resources.length})`, icon: BookOpen },
          { k: "review" as const, label: "Review", icon: BrainCircuit },
        ].map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "px-4 py-2 text-sm flex items-center gap-2 border-b-2 transition-colors",
              tab === k
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "notes" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Notes about {skill.name}</h3>
            <button onClick={createNewNote} className="btn-primary">
              <Plus size={14} /> New note
            </button>
          </div>
          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              text={`No notes about ${skill.name} yet.`}
              action="Create one"
              onClick={createNewNote}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {notes.map((n) => (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  className="surface p-4 hover:border-border-strong"
                >
                  <div className="font-medium mb-1">{n.title}</div>
                  <p className="text-xs text-fg-muted line-clamp-2 mb-2">
                    {n.content.replace(/[#*`>]/g, "").slice(0, 200)}
                  </p>
                  <div className="text-[10px] text-fg-subtle">
                    Updated {relativeTime(n.updated_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "snippets" && (
        <div>
          {snippets.length === 0 ? (
            <EmptyState
              icon={Code2}
              text="No snippets tied to this skill yet."
              action="Go to Snippets"
              onClick={() => navigate("/snippets")}
            />
          ) : (
            <div className="space-y-2">
              {snippets.map((s) => (
                <Link
                  key={s.id}
                  to="/snippets"
                  className="block surface p-4 hover:border-border-strong"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium">{s.title}</div>
                    <span className="chip">{s.language}</span>
                  </div>
                  <pre className="text-xs bg-bg-inset p-2 rounded font-mono overflow-hidden line-clamp-2">
                    {s.code}
                  </pre>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "resources" && (
        <div>
          {resources.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              text="No resources linked yet."
              action="Browse resources"
              onClick={() => navigate("/resources")}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resources.map((r) => (
                <a
                  key={r.id}
                  href={r.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="surface p-4 hover:border-border-strong"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium flex-1 truncate">{r.title}</div>
                    <span className="chip">{r.type}</span>
                  </div>
                  <div className="text-xs text-fg-muted">
                    {r.status} • {r.progress}%
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "review" && (
        <div className="surface p-6 text-center">
          <BrainCircuit size={32} className="text-accent mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">Review {skill.name}</h3>
          <p className="text-sm text-fg-muted mb-4">
            Last reviewed: {skill.last_reviewed_at ? relativeTime(skill.last_reviewed_at) : "Never"}<br />
            Next: {skill.next_review_at ? relativeTime(skill.next_review_at) : "Now"}
          </p>
          <button onClick={() => navigate("/review")} className="btn-primary">
            <BrainCircuit size={14} /> Go to review session
          </button>
        </div>
      )}

      {editing && (
        <EditSkillModal
          skill={skill}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div className="surface p-3">
      <div className="text-[10px] text-fg-muted uppercase tracking-wider">{label}</div>
      <div className={cn("text-lg font-semibold mt-0.5", accent)}>{value}</div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  action,
  onClick,
}: {
  icon: typeof Code2;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="surface p-8 text-center">
      <Icon size={28} className="text-fg-muted mx-auto mb-2" />
      <p className="text-sm text-fg-muted mb-3">{text}</p>
      <button onClick={onClick} className="btn-primary">
        {action}
      </button>
    </div>
  );
}

function EditSkillModal({
  skill,
  onClose,
  onSaved,
}: {
  skill: Skill;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [color, setColor] = useState(skill.color);
  const [level, setLevel] = useState(skill.level);
  const [tags, setTags] = useState(skill.tags.join(", "));
  const pushToast = useUI((s) => s.pushToast);

  const save = async () => {
    try {
      await updateSkill(skill.id, {
        name,
        description,
        color,
        level,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      } as any);
      pushToast("Saved", "success");
      onSaved();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[480px] surface-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border font-semibold">Edit skill</div>
        <div className="p-5 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[100px]"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="input"
            placeholder="Tags (comma-separated)"
          />
          <div>
            <div className="text-xs text-fg-muted uppercase mb-1">Level</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setLevel(i)}
                  className="flex-1 h-8 rounded-md border"
                  style={{
                    background: i <= level ? levelColor(level) : "transparent",
                    borderColor: i <= level ? levelColor(level) : "#1f2937",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}
