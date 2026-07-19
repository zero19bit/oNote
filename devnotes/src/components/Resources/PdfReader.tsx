import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertCircle } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Vite + Tauri: load the worker as a real asset URL.
// In dev mode the worker is served by Vite; in production the build copies
// it to dist/assets/ and the ?url suffix makes Vite hand us a stable URL.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type Props = {
  fileUrl: string;
};

export function PdfReader({ fileUrl }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const onLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPage(1);
    setError(null);
  };

  const onLoadError = (e: Error) => {
    // The most common failure in Tauri is the asset-protocol URL not being
    // reachable (e.g. scope doesn't cover the file location).
    console.error("[PdfReader] load error", e);
    setError(
      `Could not load PDF: ${e.message}\n\n` +
        `If this file is outside oNote's library, check the assetProtocol scope in tauri.conf.json.`
    );
  };

  // Clamp a target page into the valid range. When we don't yet know
  // the total (numPages === 0) we fall back to >= 1.
  const goToPage = (target: number) => {
    if (!Number.isFinite(target)) return;
    const max = numPages > 0 ? numPages : Number.POSITIVE_INFINITY;
    const next = Math.max(1, Math.min(max, Math.floor(target)));
    setPage(next);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-center gap-3 py-2 border-b border-border shrink-0">
        <button
          type="button"
          className="btn-ghost p-1"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
          title="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <PageJump page={page} numPages={numPages} onJump={goToPage} />
        <button
          type="button"
          className="btn-ghost p-1"
          disabled={numPages > 0 && page >= numPages}
          onClick={() => goToPage(page + 1)}
          title="Next page"
        >
          <ChevronRight size={18} />
        </button>
        <span className="w-px h-5 bg-border mx-1" />
        <button
          type="button"
          className="btn-ghost p-1"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-fg-muted w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          className="btn-ghost p-1"
          onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-bg-base">
        {error ? (
          <div className="max-w-md text-center space-y-3 self-center">
            <AlertCircle size={28} className="text-red-400 mx-auto" />
            <p className="text-sm text-red-300 whitespace-pre-wrap font-mono text-left">
              {error}
            </p>
            <p className="text-xs text-fg-muted">
              File URL: <code className="break-all">{fileUrl}</code>
            </p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={<p className="text-sm text-fg-muted self-center">Loading PDF…</p>}
            error={
              <p className="text-sm text-red-400 self-center">Could not load PDF.</p>
            }
            className="pdf-document"
          >
            <Page
              pageNumber={page}
              width={Math.min(900, window.innerWidth - 48) * scale}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}

/**
 * The "Page N of M" pill. Click to edit, type a page number, press
 * Enter (or blur) to jump. Up/Down arrow keys also step by one, and
 * Escape cancels the edit. Out-of-range or non-numeric input is
 * clamped when the user commits.
 */
function PageJump({
  page,
  numPages,
  onJump,
}: {
  page: number;
  numPages: number;
  onJump: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(page));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the draft in sync when the actual page changes (e.g. user
  // pressed the chevron buttons or jumped via scroll). We only re-sync
  // while NOT editing, otherwise the user's keystrokes would be lost.
  useEffect(() => {
    if (!editing) setDraft(String(page));
  }, [page, editing]);

  // Focus + select-all the moment we flip into edit mode.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n !== page) onJump(n);
    setEditing(false);
    // Always reset the visible draft to the canonical page so the
    // pill doesn't stay stuck on whatever the user typed if it was
    // out of range.
    setDraft(String(n === page ? page : n));
  };

  const cancel = () => {
    setDraft(String(page));
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Click to jump to a page"
        className="text-sm text-fg-muted hover:text-fg hover:bg-bg-elevated px-2 py-0.5 rounded min-w-[80px] text-center tabular-nums"
      >
        Page {page}
        {numPages > 0 ? ` of ${numPages}` : ""}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      onReset={(e) => {
        e.preventDefault();
        cancel();
      }}
      className="flex items-center gap-1 text-sm text-fg-muted"
    >
      <span>Page</span>
      <input
        ref={inputRef}
        type="number"
        min={1}
        max={numPages > 0 ? numPages : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onJump(page + 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onJump(page - 1);
          }
        }}
        onBlur={commit}
        className="w-12 bg-bg-elevated border border-border rounded px-1.5 py-0.5 text-sm text-fg text-center outline-none focus:border-accent tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {numPages > 0 && <span>of {numPages}</span>}
    </form>
  );
}
