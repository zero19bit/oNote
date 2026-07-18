import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Target, X, Check } from "lucide-react";
import { Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";

interface ProjectMultiSelectProps {
  available: Project[];
  selected: string[]; // project ids
  onChange: (ids: string[]) => void;
  onCreateProject?: (name: string) => Promise<Project | null>;
  disabled?: boolean;
  /** Compact render — only shows count + a small button. */
  compact?: boolean;
}

/**
 * Apple-Notes-style multi-select for project tags on a note.
 *
 * - Shows a chip row of currently-selected projects with × to remove.
 * - Opens a popover with a search box, the full list (with checkboxes for
 *   the selected ones), and a "create new project" affordance.
 * - Click-outside closes the popover. The popover is positioned under the
 *   trigger and right-aligned so it doesn't overflow the viewport.
 */
export function ProjectMultiSelect({
  available,
  selected,
  onChange,
  onCreateProject,
  disabled = false,
  compact = false,
}: ProjectMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedProjects = useMemo(
    () => available.filter((p) => selectedSet.has(p.id)),
    [available, selectedSet]
  );
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return available;
    return available.filter((p) => p.name.toLowerCase().includes(ql));
  }, [available, q]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selected.filter((x) => x !== id));
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateProject) return;
    setCreating(true);
    try {
      const p = await onCreateProject(name);
      if (p) {
        onChange([...selected, p.id]);
        setNewName("");
        pushToast(`Created project "${p.name}"`, "success");
      }
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to create project", "error");
    } finally {
      setCreating(false);
    }
  };

  const triggerLabel = compact
    ? selectedProjects.length > 0
      ? `${selectedProjects.length} project${selectedProjects.length === 1 ? "" : "s"}`
      : "Link to project"
    : selectedProjects.length > 0
      ? "Projects"
      : "Link to project";

  return (
    <div ref={ref} className={cn("relative inline-block", compact && "w-auto")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
          "border border-border bg-bg-inset hover:border-border-strong",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "border-accent ring-1 ring-accent"
        )}
        title={disabled ? "Save the note first" : "Manage project links"}
      >
        <Target size={11} className="text-fg-muted" />
        <span className="truncate max-w-[160px]">{triggerLabel}</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 surface-elevated shadow-card",
            "w-[280px] max-h-[360px] flex flex-col"
          )}
        >
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects..."
              className="input"
            />
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-fg-muted text-center">
                No projects match.
              </div>
            )}
            {filtered.map((p) => {
              const active = selectedSet.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm",
                    "hover:bg-bg-elevated",
                    active && "bg-accent/10"
                  )}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                      active
                        ? "bg-accent border-accent text-bg-base"
                        : "border-border"
                    )}
                  >
                    {active && <Check size={11} />}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                </button>
              );
            })}
          </div>

          {onCreateProject && (
            <div className="border-t border-border p-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCreate();
                    }
                  }}
                  placeholder="New project..."
                  className="input"
                />
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating || !newName.trim()}
                  className="btn-primary px-2 py-1.5"
                  title="Create project"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected project chips (visible when not compact). */}
      {!compact && selectedProjects.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedProjects.map((p) => (
            <span
              key={p.id}
              className="chip"
              style={{ borderColor: p.id ? undefined : undefined }}
            >
              <Target size={10} className="text-accent" />
              {p.name}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="ml-0.5 -mr-1 p-0.5 rounded hover:bg-bg-elevated"
                aria-label={`Unlink ${p.name}`}
                title={`Unlink ${p.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
