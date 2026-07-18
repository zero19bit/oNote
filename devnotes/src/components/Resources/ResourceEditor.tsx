import { useEffect, useMemo, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  createResource,
  updateResource,
  stageResourceFile,
  type Resource,
  type ResourceKind,
  type ResourceSourceMode,
  type ResourceStatus,
  type Skill,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { KIND_META, RESOURCE_KINDS, supportsLocalSource } from "./resourceMeta";

type Props = {
  resource: Partial<Resource>;
  skills: Skill[];
  onClose: () => void;
  onSaved: () => void;
};

export function ResourceEditor({ resource, skills, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(resource.title ?? "");
  const [type, setType] = useState<ResourceKind>((resource.type as ResourceKind) ?? "website");
  const [sourceMode, setSourceMode] = useState<ResourceSourceMode>(
    resource.source_mode ?? "url"
  );
  const [url, setUrl] = useState(resource.url ?? "");
  const [localPath, setLocalPath] = useState(resource.local_path ?? "");
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState("");
  const [status, setStatus] = useState<ResourceStatus>(resource.status ?? "to_read");
  const [progress, setProgress] = useState(resource.progress ?? 0);
  const [description, setDescription] = useState(resource.description ?? "");
  const [tags, setTags] = useState((resource.tags ?? []).join(", "));
  const [skillId, setSkillId] = useState<string | null>(resource.skill_id ?? null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const pushToast = useUI((s) => s.pushToast);
  const isNew = !resource.id;

  // When the type changes, clear out the field that no longer applies
  // (and keep the other one — the form is reactive, not step-by-step).
  useEffect(() => {
    if (!supportsLocalSource(type)) {
      setSourceMode("url");
      setLocalPath("");
      setPendingFile(null);
      setManualPath("");
    } else if (sourceMode === "local") {
      setUrl("");
    } else {
      setLocalPath("");
      setPendingFile(null);
      setManualPath("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const onSourceModeChange = (mode: ResourceSourceMode) => {
    setSourceMode(mode);
    if (mode === "url") {
      setLocalPath("");
      setPendingFile(null);
      setManualPath("");
    } else {
      setUrl("");
    }
  };

  const setFile = (path: string) => {
    if (!path) return;
    setPendingFile(path);
    setLocalPath("");
    setManualPath(path);
  };

  const pickFile = async () => {
    const filters =
      type === "book"
        ? [{ name: "PDF", extensions: ["pdf"] }]
        : [{ name: "Video", extensions: ["mp4", "webm", "mkv", "mov", "avi"] }];
    const selected = await openDialog({ multiple: false, filters });
    if (typeof selected === "string") {
      setFile(selected);
    }
  };

  // Drag & drop: only honoured in Tauri webview via the native file path
  // (HTML5 File objects don't expose absolute paths any more).
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      if (supportsLocalSource(type) && sourceMode === "local") setDragOver(true);
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    };
    const onOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      // Tauri's webview exposes file paths on dataTransfer.file.path on drop
      const files = Array.from(e.dataTransfer?.files ?? []);
      const path = (files[0] as unknown as { path?: string })?.path;
      if (path) setFile(path);
    };
    el.addEventListener("dragenter", onEnter);
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onEnter);
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [type, sourceMode]);

  const savePayload = useMemo(
    () => ({
      title: title.trim(),
      type,
      source_mode: supportsLocalSource(type) ? sourceMode : ("url" as const),
      url: supportsLocalSource(type) && sourceMode === "local" ? "" : url.trim(),
      local_path:
        supportsLocalSource(type) && sourceMode === "local" ? localPath : "",
      status,
      progress,
      description,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      skill_id: skillId,
    }),
    [
      title,
      type,
      sourceMode,
      url,
      localPath,
      status,
      progress,
      description,
      tags,
      skillId,
    ]
  );

  const save = async () => {
    if (!title.trim()) {
      pushToast("Title is required", "error");
      return;
    }
    if (supportsLocalSource(type) && sourceMode === "local") {
      if (!pendingFile && !localPath && !manualPath) {
        pushToast("Choose a file or paste a path", "error");
        return;
      }
    } else if (!url.trim()) {
      pushToast("URL is required", "error");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await createResource(savePayload);
        let staged = created.local_path;
        if (pendingFile) {
          staged = await stageResourceFile(pendingFile, created.id);
        } else if (!staged && manualPath) {
          // No file picker, just a pasted path — copy it into the library too.
          try {
            staged = await stageResourceFile(manualPath, created.id);
          } catch {
            // fall back to raw path; the viewer still works if the file is reachable
            staged = manualPath;
          }
        }
        if (staged && staged !== created.local_path) {
          await updateResource(created.id, { ...savePayload, local_path: staged });
        }
      } else {
        let nextLocal = localPath;
        const sourceForStaging = pendingFile || (manualPath && !localPath ? manualPath : null);
        if (sourceForStaging) {
          nextLocal = await stageResourceFile(sourceForStaging, resource.id!);
        }
        await updateResource(resource.id!, {
          ...savePayload,
          local_path:
            supportsLocalSource(type) && sourceMode === "local" ? nextLocal : "",
        });
      }
      pushToast(isNew ? "Saved" : "Updated", "success");
      onSaved();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto surface-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-border font-semibold sticky top-0 bg-bg-elevated z-10">
          {isNew ? "New resource" : "Edit resource"}
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Designing Data-Intensive Applications"
              autoFocus
              dir="auto"
              className="input bidi-plaintext w-full"
            />
          </div>

          {/* Type picker — reactive: changing this reshapes the form below */}
          <div>
            <label className="text-xs text-fg-muted mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {RESOURCE_KINDS.map((k) => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setType(k)}
                    className={cn(
                      "chip cursor-pointer flex items-center gap-1",
                      type === k && "bg-accent/20 border-accent/50 text-accent"
                    )}
                  >
                    <Icon size={12} /> {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-fg-muted mt-1.5">
              {KIND_META[type].emptyHint}
            </p>
          </div>

          {/* Source — local vs URL (only for book / video) */}
          {supportsLocalSource(type) && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1.5 block">Source</label>
              <div className="flex gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => onSourceModeChange("url")}
                  className={cn(
                    "chip cursor-pointer",
                    sourceMode === "url" && "bg-accent/20 border-accent/50 text-accent"
                  )}
                >
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => onSourceModeChange("local")}
                  className={cn(
                    "chip cursor-pointer",
                    sourceMode === "local" && "bg-accent/20 border-accent/50 text-accent"
                  )}
                >
                  Local file
                </button>
              </div>
              {sourceMode === "local" ? (
                <div
                  ref={dropRef}
                  className={cn(
                    "rounded-md border border-dashed border-border p-3 space-y-2 transition-colors",
                    dragOver && "border-accent bg-accent/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={pickFile} className="btn-ghost text-sm">
                      Choose file…
                    </button>
                    <span className="text-xs text-fg-muted">or drop a file here</span>
                  </div>
                  <input
                    value={manualPath}
                    onChange={(e) => {
                      setManualPath(e.target.value);
                      if (e.target.value && !pendingFile) {
                        setLocalPath("");
                      }
                    }}
                    placeholder="…or paste a file path (e.g. C:\books\my.pdf)"
                    className="input w-full text-xs"
                    dir="ltr"
                  />
                  {(pendingFile || localPath) && (
                    <p className="text-xs text-fg-muted break-all" dir="ltr">
                      {pendingFile
                        ? pendingFile
                        : localPath
                          ? "Stored in oNote library"
                          : null}
                    </p>
                  )}
                </div>
              ) : (
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    type === "book"
                      ? "https://… (link to a PDF)"
                      : "https://… (link to a video)"
                  }
                  className="input w-full"
                  dir="ltr"
                />
              )}
            </div>
          )}

          {/* URL-only kinds */}
          {!supportsLocalSource(type) && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1 block">URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === "course"
                    ? "https://… (course landing page)"
                    : type === "podcast"
                      ? "https://… (episode or feed URL)"
                      : "https://…"
                }
                className="input w-full"
                dir="ltr"
              />
            </div>
          )}

          {/* Status + progress */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1 block">
              Status &amp; progress
            </label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ResourceStatus)}
                className="input"
                aria-label="Status"
              >
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
                onChange={(e) =>
                  setProgress(Math.max(0, Math.min(100, Number(e.target.value))))
                }
                placeholder="0–100"
                aria-label="Progress percent"
                className="input col-span-2"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              dir="auto"
              placeholder="Why this resource? Key takeaways?"
              className="input min-h-[80px] resize-y bidi-plaintext w-full"
            />
          </div>

          {/* Tags + skill */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1 block">Tags</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated"
                className="input"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-fg-muted mb-1 block">Skill</label>
              <select
                value={skillId ?? ""}
                onChange={(e) => setSkillId(e.target.value || null)}
                className="input"
              >
                <option value="">— none —</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-bg-elevated">
          <button onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button onClick={save} className="btn-primary" disabled={saving}>
            {isNew ? "Save" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
