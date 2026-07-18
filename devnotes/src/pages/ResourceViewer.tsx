import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowLeft, ExternalLink, Edit3 } from "lucide-react";
import { getResource, updateResource, type Resource } from "@/lib/api";
import { canViewInApp } from "@/lib/openResource";
import { useUI } from "@/store/ui";
import { PdfReader } from "@/components/Resources/PdfReader";
import { KIND_META } from "@/components/Resources/resourceMeta";
import { relativeTime, cn } from "@/lib/utils";

export function ResourceViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pushToast = useUI((s) => s.pushToast);
  const [resource, setResource] = useState<Resource | null>(null);
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await getResource(id);
      setResource(r);
      setProgress(r.progress);
    } catch (e: any) {
      pushToast(e?.message ?? "Resource not found", "error");
      navigate("/resources");
    }
  }, [id, navigate, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  const persistProgress = async (value: number) => {
    if (!resource) return;
    setProgress(value);
    try {
      await updateResource(resource.id, {
        title: resource.title,
        progress: value,
        status:
          value >= 100
            ? "done"
            : resource.status === "to_read"
              ? "in_progress"
              : resource.status,
      });
      setResource((prev) =>
        prev
          ? {
              ...prev,
              progress: value,
              status:
                value >= 100
                  ? "done"
                  : prev.status === "to_read"
                    ? "in_progress"
                    : prev.status,
            }
          : prev
      );
    } catch {
      /* ignore debounced save noise */
    }
  };

  if (!resource) {
    return <div className="p-6 text-sm text-fg-muted">Loading…</div>;
  }

  const meta = KIND_META[resource.type];
  const TypeIcon = meta.icon;
  const isLocal = resource.source_mode === "local" && resource.local_path;
  const localSrc = isLocal ? convertFileSrc(resource.local_path!) : null;
  const showPdf =
    resource.type === "book" && !!localSrc && resource.local_path!.toLowerCase().endsWith(".pdf");
  const showVideo = resource.type === "video" && !!localSrc;
  const showInAppMedia = showPdf || showVideo;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => navigate("/resources")} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </button>
        <div className="w-9 h-9 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
          <TypeIcon size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">{resource.title}</h1>
          <p className="text-xs text-fg-muted">
            {meta.label}
            {isLocal ? " · local file" : resource.url ? " · link" : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost p-2"
          onClick={() => navigate(`/resources`)}
          title="Back to list"
        >
          <Edit3 size={14} />
        </button>
        {resource.url && (
          <button
            type="button"
            className="btn-ghost text-sm flex items-center gap-1"
            onClick={() => openUrl(resource.url)}
          >
            <ExternalLink size={14} /> Open link
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <span className="text-xs text-fg-muted w-16">Progress</span>
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => persistProgress(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-fg-muted w-10 text-right">{progress}%</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {showPdf && <PdfReader fileUrl={localSrc!} />}
        {showVideo && (
          <div className="h-full flex items-center justify-center bg-black p-4">
            <video src={localSrc!} controls className="max-h-full max-w-full" />
          </div>
        )}
        {!showInAppMedia && (
          <div className="h-full overflow-y-auto">
            <NoMediaState resource={resource} />
          </div>
        )}
      </div>
    </div>
  );
}

function NoMediaState({ resource }: { resource: Resource }) {
  const meta = KIND_META[resource.type];
  const TypeIcon = meta.icon;
  const url = resource.url?.trim();

  const kindHint: Record<typeof resource.type, string> = {
    book: url
      ? "This is a link to a PDF or book. Open it in your browser to read."
      : "No file or link is attached to this book yet — edit the resource to add one.",
    video: url
      ? "This is a link to a video. Open it in your browser to watch."
      : "No file or link is attached to this video yet — edit the resource to add one.",
    course: "This is an online course. The link will open in your default browser.",
    podcast: "This is a podcast or episode link. The link will open in your default browser.",
    website: "Bookmarked site or page. The link will open in your default browser.",
  };

  let host = "";
  if (url) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* keep empty */
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="surface p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4">
          <TypeIcon size={22} className="text-accent" />
        </div>
        <h2 className="text-lg font-semibold mb-1">{resource.title}</h2>
        <p className="text-xs text-fg-muted mb-4">{meta.label}{host ? ` · ${host}` : ""}</p>
        <p className="text-sm text-fg-muted mb-5">{kindHint[resource.type]}</p>
        {url ? (
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => openUrl(url)}
          >
            <ExternalLink size={14} /> Open in browser
          </button>
        ) : (
          <p className="text-xs text-fg-subtle">Add a URL or local file from the resources list.</p>
        )}
        {resource.description && (
          <div className="mt-6 pt-5 border-t border-border text-left">
            <h3 className="text-xs uppercase tracking-wider text-fg-muted mb-1.5">Notes</h3>
            <p className="text-sm whitespace-pre-wrap bidi-plaintext">{resource.description}</p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-fg-subtle">
          <span className={cn("chip")}>
            {relativeTime(resource.updated_at)}
          </span>
          {resource.tags.map((t) => (
            <span key={t} className="chip">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
