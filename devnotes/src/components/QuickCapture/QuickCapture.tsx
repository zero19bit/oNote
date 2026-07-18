import { useEffect, useState } from "react";
import { X, Zap, Inbox as InboxIcon } from "lucide-react";
import { useUI } from "@/store/ui";
import { addInbox } from "@/lib/api";
import { shortcutKeys } from "@/lib/utils";

export function QuickCapture() {
  const open = useUI((s) => s.quickCaptureOpen);
  const setOpen = useUI((s) => s.setQuickCapture);
  const pushToast = useUI((s) => s.pushToast);
  const platform = useUI((s) => s.platform);
  const submitKeys = shortcutKeys(platform, "mod", "↵");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) setContent("");
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const v = content.trim();
    if (!v) return;
    try {
      await addInbox(v);
      pushToast("Captured to inbox", "success");
      window.dispatchEvent(new CustomEvent("inbox:changed"));
      setOpen(false);
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to capture", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[92vw] surface-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <Zap size={16} className="text-accent" />
          <span className="text-sm font-medium">Quick Capture</span>
          <span className="text-[10px] text-fg-muted uppercase tracking-wider ml-2">
            Goes to Inbox — process later
          </span>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-fg-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>

        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Type a thought, link, code snippet, anything..."
          dir="auto"
          className="w-full bg-transparent p-4 outline-none resize-none text-sm min-h-[120px] placeholder:text-fg-subtle bidi-plaintext"
        />

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          <div className="text-[11px] text-fg-muted flex items-center gap-2">
            <InboxIcon size={12} />
            Will land in Inbox
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost">
              Cancel
            </button>
            <button onClick={submit} className="btn-primary">
              Capture
              <span className="flex items-center gap-1 ml-1">
                {submitKeys.map((k, i) => (
                  <span key={i} className="kbd">{k}</span>
                ))}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
