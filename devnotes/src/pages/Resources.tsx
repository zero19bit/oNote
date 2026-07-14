import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Trash2,
  BookOpen,
  CheckCircle2,
  Clock,
  Pause,
  Archive,
} from "lucide-react";
import {
  listResources,
  createResource,
  updateResource,
  deleteResource,
  listSkills,
  Resource,
  Skill,
  ResourceStatus,
} from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { useUI } from "@/store/ui";

const STATUS_META: Record<ResourceStatus, { label: string; color: string; icon: typeof Clock }> = {
  to_read: { label: "To read", color: "text-fg-muted bg-bg-elevated", icon: Clock },
  in_progress: { label: "In progress", color: "text-accent bg-accent/20", icon: Pause },
  done: { label: "Done", color: "text-green-300 bg-green-500/20", icon: CheckCircle2 },
  archived: { label: "Archived", color: "text-fg-subtle bg-bg-elevated", icon: Archive },
};

export function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | null>(null);
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    try {
      setResources(await listResources());
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
      setEditing({ title: "", url: "", type: "article", status: "to_read", progress: 0, description: "", tags: [] });
    window.addEventListener("resources:new", handler);
    return () => window.removeEventListener("resources:new", handler);
  }, []);

  const filtered = useMemo(() => {
    return resources
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.title} ${r.description} ${r.tags.join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  }, [resources, q, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { to_read: 0, in_progress: 0, done: 0, archived: 0 };
    resources.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [resources]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <Search size={14} className="text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-search-input
            placeholder="Search resources..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={() =>
            setEditing({ title: "", url: "", type: "article", status: "to_read", progress: 0, description: "", tags: [] })
          }
          className="btn-primary"
        >
          <Plus size={14} /> New resource
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setStatusFilter(null)}
          className={cn("chip cursor-pointer", !statusFilter && "bg-accent/20 border-accent/50 text-accent")}
        >
          All ({resources.length})
        </button>
        {(Object.keys(STATUS_META) as ResourceStatus[]).map((s) => {
          const m = STATUS_META[s];
          const Icon = m.icon;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "chip cursor-pointer",
                statusFilter === s && "bg-accent/20 border-accent/50 text-accent"
              )}
            >
              <Icon size={10} /> {m.label} ({counts[s] ?? 0})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <BookOpen size={32} className="text-fg-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No resources</h3>
          <p className="text-sm text-fg-muted mb-4">
            Save articles, videos, courses, and books you want to learn from.
          </p>
          <button
            onClick={() =>
              setEditing({ title: "", url: "", type: "article", status: "to_read", progress: 0, description: "", tags: [] })
            }
            className="btn-primary"
          >
            <Plus size={14} /> Add a resource
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const m = STATUS_META[r.status];
            const Icon = m.icon;
            return (
              <div key={r.id} className="surface p-4 hover:border-border-strong group">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <a
                      href={r.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold hover:text-accent line-clamp-2 block"
                    >
                      {r.title}
                    </a>
                    <div className="text-[11px] text-fg-muted uppercase tracking-wider mt-0.5">
                      {r.type}
                    </div>
                  </div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-fg-muted hover:text-accent">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {r.description && (
                  <p className="text-xs text-fg-muted line-clamp-2 mb-2">{r.description}</p>
                )}

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] text-fg-muted mb-1">
                    <span>Progress</span>
                    <span>{r.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-brand-purple"
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 border-t border-border">
                  <span className={cn("chip", m.color)}>
                    <Icon size={10} /> {m.label}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setEditing(r)} className="p-1 hover:bg-bg-elevated rounded">
                      <Edit3 size={12} className="text-fg-muted" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${r.title}"?`)) return;
                        await deleteResource(r.id);
                        pushToast("Deleted", "success");
                        load();
                      }}
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

      {editing && (
        <ResourceEditor
          resource={editing}
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

function ResourceEditor({
  resource,
  skills,
  onClose,
  onSaved,
}: {
  resource: Partial<Resource>;
  skills: Skill[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(resource.title ?? "");
  const [url, setUrl] = useState(resource.url ?? "");
  const [type, setType] = useState(resource.type ?? "article");
  const [status, setStatus] = useState(resource.status ?? "to_read");
  const [progress, setProgress] = useState(resource.progress ?? 0);
  const [description, setDescription] = useState(resource.description ?? "");
  const [tags, setTags] = useState((resource.tags ?? []).join(", "));
  const [skillId, setSkillId] = useState<string | null>(resource.skill_id ?? null);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = !resource.id;

  const save = async () => {
    if (!title.trim()) {
      pushToast("Title is required", "error");
      return;
    }
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (isNew) {
        await createResource({
          title, url, type, status, progress, description, tags: tagList, skill_id: skillId,
        } as any);
      } else {
        await updateResource(resource.id!, {
          title, url, type, status, progress, description, tags: tagList, skill_id: skillId,
        } as any);
      }
      pushToast(isNew ? "Saved" : "Updated", "success");
      onSaved();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[520px] max-w-[95vw] surface-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border font-semibold">
          {isNew ? "New resource" : "Edit resource"}
        </div>
        <div className="p-5 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" autoFocus dir="auto" className="input bidi-plaintext" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="input" />
          <div className="grid grid-cols-3 gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
              <option value="article">article</option>
              <option value="video">video</option>
              <option value="course">course</option>
              <option value="book">book</option>
              <option value="podcast">podcast</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input">
              <option value="to_read">to read</option>
              <option value="in_progress">in progress</option>
              <option value="done">done</option>
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
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            dir="auto"
            placeholder="Why this resource? Key takeaways?"
            className="input min-h-[80px] resize-y bidi-plaintext"
          />
          <div className="grid grid-cols-2 gap-3">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags" className="input" />
            <select value={skillId ?? ""} onChange={(e) => setSkillId(e.target.value || null)} className="input">
              <option value="">— no skill —</option>
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary">{isNew ? "Save" : "Update"}</button>
        </div>
      </div>
    </div>
  );
}
