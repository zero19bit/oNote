import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";

export function AchievementToaster() {
  const [queue, setQueue] = useState<any[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      const a = e.detail;
      setQueue((q) => [...q, a]);
      setTimeout(() => {
        setQueue((q) => q.filter((x) => x !== a));
      }, 5000);
    };
    window.addEventListener("achievement:unlocked", handler);
    return () => window.removeEventListener("achievement:unlocked", handler);
  }, []);

  return (
    <div className="fixed top-20 right-6 z-50 space-y-2">
      {queue.map((a) => (
        <div
          key={a.code}
          className="flex items-center gap-3 px-4 py-3 rounded-lg surface-elevated border-l-4 border-l-accent shadow-glow animate-fade-in min-w-[300px]"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-brand-purple flex items-center justify-center">
            <Trophy size={18} className="text-bg-base" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-fg-muted uppercase tracking-wider">Achievement Unlocked</div>
            <div className="text-sm font-semibold">{a.title}</div>
            <div className="text-xs text-fg-muted">{a.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
