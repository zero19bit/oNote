import { useUI } from "@/store/ui";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2">
      {toasts.map((t) => {
        const Icon =
          t.tone === "success"
            ? CheckCircle2
            : t.tone === "error"
            ? AlertCircle
            : Info;
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-card animate-fade-in min-w-[280px]",
              t.tone === "success"
                ? "bg-bg-surface border-green-500/30 text-green-200"
                : t.tone === "error"
                ? "bg-bg-surface border-red-500/30 text-red-200"
                : "bg-bg-surface border-border text-fg"
            )}
          >
            <Icon size={16} />
            <span className="text-sm flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
