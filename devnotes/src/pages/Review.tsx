import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Sparkles,
  StickyNote,
  Code2,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Flame,
  TrendingUp,
} from "lucide-react";
import { getDueForReview, submitReview, ReviewItem } from "@/lib/api";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

export function Review() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [current, setCurrent] = useState<ReviewItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [done, setDone] = useState(false);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    const items = await getDueForReview(50);
    setQueue(items);
    if (items.length === 0) {
      setDone(true);
      setCurrent(null);
    } else {
      setCurrent(items[0]);
      setRevealed(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rate = async (q: number) => {
    if (!current) return;
    try {
      await submitReview(current.target_type, current.target_id, q);
      const next = queue.slice(1);
      setQueue(next);
      setReviewedCount((c) => c + 1);
      if (next.length === 0) {
        setDone(true);
        setCurrent(null);
        window.dispatchEvent(new CustomEvent("achievement:recheck"));
      } else {
        setCurrent(next[0]);
        setRevealed(false);
      }
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to submit", "error");
    }
  };

  if (done) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="surface-elevated p-12">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-accent" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Queue cleared</h2>
          <p className="text-fg-muted mb-6">
            You reviewed <span className="text-accent font-semibold">{reviewedCount}</span> item
            {reviewedCount !== 1 && "s"}. Come back later — new items will surface when due.
          </p>
          <button onClick={load} className="btn-outline">
            <RotateCcw size={14} /> Check for more
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return <div className="p-8 text-fg-muted text-sm">Loading review queue...</div>;
  }

  const Icon = current.target_type === "skill" ? Sparkles : current.target_type === "note" ? StickyNote : Code2;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-brand-purple transition-all"
            style={{ width: `${(reviewedCount / (reviewedCount + queue.length)) * 100}%` }}
          />
        </div>
        <div className="text-xs text-fg-muted font-mono">
          {reviewedCount} / {reviewedCount + queue.length}
        </div>
      </div>

      <div className="surface-elevated p-8 min-h-[400px] flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute top-4 left-4 chip">
          <Icon size={11} />
          {current.target_type}
        </div>
        <div className="absolute top-4 right-4 chip">
          <TrendingUp size={11} />
          ease {current.ease.toFixed(2)}
        </div>

        <BrainCircuit size={40} className="text-accent mb-4" />
        <h2 className="text-2xl font-bold mb-1">{current.title}</h2>
        {current.skill_id && (
          <p className="text-xs text-fg-muted mb-4">Linked to a skill</p>
        )}

        <div className="my-6 max-w-md">
          {current.preview ? (
            <p className={cn("text-fg-muted whitespace-pre-wrap", !revealed && "select-none")}>
              {revealed ? current.preview : "••• click Reveal to see the description •••"}
            </p>
          ) : (
            <p className="text-fg-subtle text-sm italic">No description. Recall what you know about this.</p>
          )}
        </div>

        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="btn-primary">
            Reveal
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="w-full max-w-md">
            <div className="text-xs text-fg-muted uppercase tracking-wider mb-2 text-center">
              How well did you remember?
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[
                { q: 0, label: "Blackout", color: "bg-red-500/20 hover:bg-red-500/40 text-red-300" },
                { q: 1, label: "Wrong", color: "bg-red-500/20 hover:bg-red-500/40 text-red-300" },
                { q: 2, label: "Almost", color: "bg-orange-500/20 hover:bg-orange-500/40 text-orange-300" },
                { q: 3, label: "Hesitant", color: "bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300" },
                { q: 4, label: "Good", color: "bg-lime-500/20 hover:bg-lime-500/40 text-lime-300" },
                { q: 5, label: "Perfect", color: "bg-green-500/20 hover:bg-green-500/40 text-green-300" },
              ].map((r) => (
                <button
                  key={r.q}
                  onClick={() => rate(r.q)}
                  className={cn("px-2 py-3 rounded-md text-xs font-medium transition-colors", r.color)}
                >
                  {r.q}
                  <div className="text-[10px] mt-0.5 opacity-70">{r.label}</div>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-fg-subtle mt-2 text-center">
              Quality ≥ 3 increases interval • &lt; 3 resets the card
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
