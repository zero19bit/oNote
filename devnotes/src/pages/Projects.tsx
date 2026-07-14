import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Target,
  CheckCircle2,
  Pause,
  Archive,
  Play,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listSkills,
  attachSkill,
  detachSkill,
  Project,
  Skill,
} from "@/lib/api";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import { useUI } from "@/store/ui";

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Play }> = {
  active: { label: "Active", color: "bg-accent/20 text-accent", icon: Play },
  paused: { label: "Paused", color: "bg-orange-500/20 text-orange-300", icon: Pause },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-300", icon: CheckCircle2 },
  archived: { label: "Archived", color: "bg-bg-elevated text-fg-muted", icon: Archive },
};

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    try {
      setProjects(await listProjects());
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
      setEditing({ name: "", description: "", status: "active", progress: 0, tags: [] });
    window.addEventListener("projects:new", handler);
    return () => window.removeEventListener("projects:new", handler);
  }, []);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (!q) return true;
      const hay = `${p.name} ${p.description} ${p.tags.join(" ")}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [projects, q]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <Search size={14} className="text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-search-input
            placeholder="Search projects..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={() => setEditing({ name: "", description: "", status: "active", progress: 0, tags: [] })}
          className="btn-primary"
        >
          <Plus size={14} /> New project
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <Target size={32} className="text-fg-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-fg-muted mb-4">
            Track learning goals, side projects, certifications — anything with progress.
          </p>
          <button
            onClick={() => setEditing({ name: "", description: "", status: "active", progress: 0, tags: [] })}
            className="btn-primary"
          >
            <Plus size={14} /> Start a project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const m = STATUS_META[p.status];
            const Icon = m.icon;
            return (
              <div key={p.id} className="surface p-4 hover:border-border-strong group">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-brand-purple/20 flex items-center justify-center shrink-0">
                    <Target size={16} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-fg-muted line-clamp-1">{p.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setEditing(p)} className="p-1 hover:bg-bg-elevated rounded">
                      <Edit3 size={12} className="text-fg-muted" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${p.name}"?`)) return;
                        await deleteProject(p.id);
                        pushToast("Deleted", "success");
                        load();
                      }}
                      className="p-1 hover:bg-bg-elevated rounded"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] text-fg-muted mb-1">
                    <span>Progress</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-brand-purple"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn("chip", m.color)}>
                      <Icon size={10} /> {m.label}
                    </span>
                    {p.target_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={10} /> {formatDate(p.target_date)}
                      </span>
                    )}
                  </div>
                  <span>{relativeTime(p.updated_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ProjectEditor
          project={editing}
          skills={skills}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProjectEditor({
  project,
  skills,
  onClose,
  onSaved,
}: {
  project: Partial<Project>;
  skills: Skill[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(project.name ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<Project["status"]>(project.status ?? "active");
  const [progress, setProgress] = useState(project.progress ?? 0);
  const [targetDate, setTargetDate] = useState(project.target_date ?? "");
  const [tags, setTags] = useState((project.tags ?? []).join(", "));
  const [linkedSkills, setLinkedSkills] = useState<string[]>([]);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = !project.id;

  // Load existing project skills if editing
  useEffect(() => {
    if (!isNew && project.id) {
      // For simplicity, we don't fetch project_skills via a separate command;
      // they can be re-attached from the form. Pre-fill empty.
      setLinkedSkills([]);
    }
  }, [project.id]);

  const toggleSkill = async (id: string) => {
    if (!project.id) {
      setLinkedSkills((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
      return;
    }
    if (linkedSkills.includes(id)) {
      await detachSkill(project.id, id);
      setLinkedSkills((arr) => arr.filter((x) => x !== id));
    } else {
      await attachSkill(project.id, id);
      setLinkedSkills((arr) => [...arr, id]);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      pushToast("Name is required", "error");
      return;
    }
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      let pid = project.id;
      if (isNew) {
        const p = await createProject({
          name, description, status, progress, target_date: targetDate || null, tags: tagList,
        } as any);
        pid = p.id;
      } else {
        await updateProject(project.id!, {
          name, description, status, progress, target_date: targetDate || null, tags: tagList,
        } as any);
      }
      // attach pending skills
      if (pid) {
        for (const s of linkedSkills) {
          await attachSkill(pid, s);
        }
      }
      pushToast(isNew ? "Project created" : "Saved", "success");
      onSaved();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[600px] max-w-[95vw] max-h-[90vh] surface-elevated flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border font-semibold">
          {isNew ? "New project" : "Edit project"}
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus dir="auto" placeholder="Project name" className="input bidi-plaintext" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            dir="auto"
            placeholder="What's the goal?"
            className="input min-h-[80px] resize-y bidi-plaintext"
          />
          <div className="grid grid-cols-3 gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as Project["status"])} className="input">
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
              <option value="archived">archived</option>
            </select>
            <input
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value))))}
              placeholder="Progress %"
              className="input"
            />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input"
            />
          </div>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags" className="input" />
          <div>
            <div className="text-xs text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles size={11} /> Linked skills
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => {
                const active = linkedSkills.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSkill(s.id)}
                    className={cn(
                      "chip cursor-pointer",
                      active && "bg-accent/20 border-accent/50 text-accent"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary">{isNew ? "Create" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
