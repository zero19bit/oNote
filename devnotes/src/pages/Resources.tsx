import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  BookOpen,
  CheckCircle2,
  Clock,
  Pause,
  Archive,
  LayoutGrid,
} from "lucide-react";
import {
  listResources,
  listSkills,
  deleteResource,
  Resource,
  Skill,
  ResourceStatus,
  ResourceKind,
} from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { ResourceEditor } from "@/components/Resources/ResourceEditor";
import {
  KIND_META,
  RESOURCE_KINDS,
  emptyResourceDefaults,
} from "@/components/Resources/resourceMeta";
import { openResource } from "@/lib/openResource";

const STATUS_META: Record<
  ResourceStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  to_read: { label: "To read", color: "text-fg-muted bg-bg-elevated", icon: Clock },
  in_progress: { label: "In progress", color: "text-accent bg-accent/20", icon: Pause },
  done: { label: "Done", color: "text-green-300 bg-green-500/20", icon: CheckCircle2 },
  archived: { label: "Archived", color: "text-fg-subtle bg-bg-elevated", icon: Archive },
};

type TabId = "all" | ResourceKind;

export function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabId>("all");
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | null>(null);
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  const pushToast = useUI((s) => s.pushToast);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [r, s] = await Promise.all([listResources(), listSkills()]);
      setResources(r);
      setSkills(s);
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to load", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => setEditing({ ...emptyResourceDefaults() });
    window.addEventListener("resources:new", handler);
    return () => window.removeEventListener("resources:new", handler);
  }, []);

  // Per-kind counts for the tab strip
  const countsByKind = useMemo(() => {
    const c: Record<string, number> = { all: resources.length };
    RESOURCE_KINDS.forEach((k) => (c[k] = 0));
    resources.forEach((r) => {
      const k = r.type as ResourceKind;
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [resources]);

  const filtered = useMemo(() => {
    return resources
      .filter((r) => (tab === "all" ? true : r.type === tab))
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.title} ${r.description} ${r.tags.join(" ")}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  }, [resources, tab, statusFilter, q]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { to_read: 0, in_progress: 0, done: 0, archived: 0 };
    resources
      .filter((r) => (tab === "all" ? true : r.type === tab))
      .forEach((r) => {
        c[r.status] = (c[r.status] ?? 0) + 1;
      });
    return c;
  }, [resources, tab]);

  const handleCardOpen = async (r: Resource) => {
    try {
      await openResource(r, navigate);
    } catch (e: any) {
      pushToast(e?.message ?? "Could not open resource", "error");
    }
  };

  const activeKindMeta = tab === "all" ? null : KIND_META[tab];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 surface">
          <Search size={14} className="text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-search-input
            placeholder={
              activeKindMeta
                ? `Search ${activeKindMeta.label.toLowerCase()}s…`
                : "Search resources…"
            }
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={() => setEditing({ ...emptyResourceDefaults(), type: tab === "all" ? "website" : (tab as ResourceKind) })}
          className="btn-primary"
        >
          <Plus size={14} /> New resource
        </button>
      </div>

      {/* Per-kind tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setTab("all")}
          className={cn(
            "chip cursor-pointer flex items-center gap-1",
            tab === "all" && "bg-accent/20 border-accent/50 text-accent"
          )}
        >
          <LayoutGrid size={10} /> All ({countsByKind.all})
        </button>
        {RESOURCE_KINDS.map((k) => {
          const meta = KIND_META[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "chip cursor-pointer flex items-center gap-1",
                tab === k && "bg-accent/20 border-accent/50 text-accent"
              )}
            >
              <Icon size={10} /> {meta.label} ({countsByKind[k] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Status filter (only when more than a few items) */}
      {resources.filter((r) => (tab === "all" ? true : r.type === tab)).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn(
              "chip cursor-pointer",
              !statusFilter && "bg-accent/20 border-accent/50 text-accent"
            )}
          >
            Any status
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
                <Icon size={10} /> {m.label} ({statusCounts[s] ?? 0})
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          tab={tab}
          onCreate={() =>
            setEditing({
              ...emptyResourceDefaults(),
              type: tab === "all" ? "website" : (tab as ResourceKind),
            })
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              onOpen={() => handleCardOpen(r)}
              onEdit={() => setEditing(r)}
              onDelete={async () => {
                if (!confirm(`Delete "${r.title}"?`)) return;
                try {
                  await deleteResource(r.id);
                  pushToast("Deleted", "success");
                  load();
                } catch (e: any) {
                  pushToast(e?.message ?? "Delete failed", "error");
                }
              }}
            />
          ))}
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

function EmptyState({ tab, onCreate }: { tab: TabId; onCreate: () => void }) {
  const meta = tab === "all" ? null : KIND_META[tab];
  const Icon = meta?.icon ?? BookOpen;
  const label = meta?.label ?? "Resources";
  const hint =
    tab === "all"
      ? "Save articles, videos, courses, and books you want to learn from."
      : meta?.emptyHint ?? "";
  return (
    <div className="surface p-12 text-center">
      <Icon size={32} className="text-fg-muted mx-auto mb-3" />
      <h3 className="text-lg font-semibold mb-1">No {label.toLowerCase()}s yet</h3>
      <p className="text-sm text-fg-muted mb-4">{hint}</p>
      <button onClick={onCreate} className="btn-primary">
        <Plus size={14} /> Add a {label.toLowerCase()}
      </button>
    </div>
  );
}

function ResourceCard({
  resource,
  onOpen,
  onEdit,
  onDelete,
}: {
  resource: Resource;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[resource.type];
  const Icon = meta.icon;
  const sm = STATUS_META[resource.status];
  const StatusIcon = sm.icon;
  const isLocal = resource.source_mode === "local" && resource.local_path;
  const isPdf =
    resource.type === "book" &&
    isLocal &&
    resource.local_path.toLowerCase().endsWith(".pdf");
  const subtitleParts: string[] = [];
  if (isLocal) subtitleParts.push("Local file");
  else if (resource.url) {
    try {
      subtitleParts.push(new URL(resource.url).hostname.replace(/^www\./, ""));
    } catch {
      subtitleParts.push("Link");
    }
  } else subtitleParts.push("No link");
  subtitleParts.push(relativeTime(resource.updated_at));
  return (
    <div className="surface p-4 hover:border-border-strong group cursor-pointer" onClick={onOpen}>
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold hover:text-accent line-clamp-2">{resource.title}</h3>
          <div className="text-[11px] text-fg-muted mt-0.5 truncate">
            {subtitleParts.join(" · ")}
          </div>
        </div>
      </div>
      {resource.description && (
        <p className="text-xs text-fg-muted line-clamp-2 mb-2">{resource.description}</p>
      )}

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] text-fg-muted mb-1">
          <span>Progress</span>
          <span>{resource.progress}%</span>
        </div>
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-brand-purple"
            style={{ width: `${resource.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-fg-subtle pt-2 border-t border-border">
        <span className={cn("chip", sm.color)}>
          <StatusIcon size={10} /> {sm.label}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 hover:bg-bg-elevated rounded"
            title="Edit"
          >
            <Edit3 size={12} className="text-fg-muted" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-bg-elevated rounded"
            title="Delete"
          >
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      </div>
      {isPdf && (
        <div className="mt-2 text-[10px] text-fg-muted uppercase tracking-wider">PDF · ready to read</div>
      )}
    </div>
  );
}
