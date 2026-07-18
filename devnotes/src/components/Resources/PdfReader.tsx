import { useState } from "react";
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-center gap-3 py-2 border-b border-border shrink-0">
        <button
          type="button"
          className="btn-ghost p-1"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm text-fg-muted min-w-[80px] text-center">
          Page {page} {numPages > 0 ? `of ${numPages}` : ""}
        </span>
        <button
          type="button"
          className="btn-ghost p-1"
          disabled={numPages > 0 && page >= numPages}
          onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
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
