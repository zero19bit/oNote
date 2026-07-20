import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Trash2, Save } from "lucide-react";
import {
  listDailyEntries,
  upsertDailyEntry,
  deleteDailyEntry,
  DailyEntry,
} from "@/lib/api";
import { useUI } from "@/store/ui";
import { cn, todayString, dateStatus, dateStatusClasses } from "@/lib/utils";

const TEMPLATES: Record<string, string> = {
  journal: `## What happened today\n\n## What I learned\n- \n\n## What I'm grateful for\n- \n\n## Tomorrow's focus\n- \n`,
  standup: `**Yesterday:**\n- \n\n**Today:**\n- \n\n**Blockers:**\n- \n`,
  postmortem: `## What happened\n\n## Timeline\n- \n\n## Root cause\n\n## What went well\n- \n\n## What didn't\n- \n\n## Action items\n- [ ] \n`,
};

export function Daily() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [activeDate, setActiveDate] = useState(todayString());
  const [active, setActive] = useState<DailyEntry | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<"journal" | "standup" | "postmortem">("journal");
  const [mood, setMood] = useState(3);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const pushToast = useUI((s) => s.pushToast);

  const load = async () => {
    try {
      const list = await listDailyEntries(180);
      setEntries(list);
    } catch (e: any) {
      pushToast(e?.message ?? "Failed to load", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const found = entries.find((e) => e.date === activeDate);
    if (found) {
      setActive(found);
      setContent(found.content);
      setKind(found.kind as any);
      setMood(found.mood);
    } else {
      setActive(null);
      setContent("");
      setKind("journal");
      setMood(3);
    }
    setSavedAt(null);
  }, [activeDate, entries]);

  const save = async () => {
    try {
      await upsertDailyEntry({ date: activeDate, kind, content, mood });
      setSavedAt(new Date().toLocaleTimeString());
      load();
    } catch (e: any) {
      pushToast(e?.message ?? "Save failed", "error");
    }
  };

  const remove = async () => {
    if (!active) return;
    if (!confirm("Delete this entry?")) return;
    await deleteDailyEntry(active.id);
    pushToast("Deleted", "success");
    load();
  };

  const shiftDate = (delta: number) => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() + delta);
    setActiveDate(d.toISOString().slice(0, 10));
  };

  // Group entries by month for sidebar
  const grouped = entries.reduce<Record<string, DailyEntry[]>>((acc, e) => {
    const k = e.date.slice(0, 7);
    (acc[k] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-bg-surface/30 overflow-y-auto p-3">
        <button
          onClick={() => setActiveDate(todayString())}
          className="btn-primary w-full mb-3"
        >
          <CalendarDays size={14} /> Today
        </button>
        {Object.entries(grouped).map(([month, list]) => (
          <div key={month} className="mb-4">
            <div className="text-[10px] text-fg-muted uppercase tracking-wider mb-1 px-1">
              {new Date(month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </div>
            {list.map((e) => {
              const status = dateStatus(e.date);
              const sc = dateStatusClasses(status);
              const isActive = activeDate === e.date;
              return (
                <button
                  key={e.id}
                  onClick={() => setActiveDate(e.date)}
                  className={cn(
                    "relative w-full text-left pl-3 pr-2 py-1.5 rounded-md text-sm flex items-center gap-2 border-l-2",
                    sc.border,
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "hover:bg-bg-elevated text-fg-muted"
                  )}
                  title={
                    status === "past"
                      ? "Past"
                      : status === "today"
                      ? "Today"
                      : "Upcoming"
                  }
                >
                  <div className={cn("w-7 text-center", isActive ? "" : sc.text)}>
                    <div className="text-xs font-semibold">
                      {new Date(e.date).getDate()}
                    </div>
                    <div className="text-[9px] uppercase opacity-80">
                      {new Date(e.date).toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{e.kind}</div>
                    <div className="text-[10px] text-fg-subtle truncate">
                      {e.content.slice(0, 30)}
                    </div>
                  </div>
                  <div className="text-xs">{"😞😐🙂😊😄"[e.mood - 1]}</div>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="btn-ghost">
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
            className="bg-transparent font-semibold outline-none"
          />
          <button onClick={() => shiftDate(1)} className="btn-ghost">
            <ChevronRight size={14} />
          </button>

          <div className="ml-3 flex items-center gap-1">
            {(["journal", "standup", "postmortem"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  if (!active) setContent(TEMPLATES[k]);
                }}
                className={cn(
                  "px-2 py-1 rounded text-[11px] uppercase tracking-wider",
                  kind === k ? "bg-accent/20 text-accent" : "text-fg-muted hover:bg-bg-elevated"
                )}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-fg-muted">Mood</span>
              {["😞", "😐", "🙂", "😊", "😄"].map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setMood(i + 1)}
                  className={cn(
                    "w-7 h-7 rounded flex items-center justify-center text-base",
                    mood === i + 1 ? "bg-accent/20" : "hover:bg-bg-elevated"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {active && (
              <button onClick={remove} className="btn-ghost text-red-400">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={save} className="btn-primary">
              <Save size={14} /> Save
            </button>
          </div>
        </div>
        {savedAt && (
          <div className="text-[10px] text-green-400 px-4 py-1 bg-green-500/5">
            Saved at {savedAt}
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          dir="auto"
          placeholder={TEMPLATES[kind]}
          className="flex-1 bg-bg-base p-6 outline-none font-mono text-sm resize-none bidi-plaintext"
        />
      </div>
    </div>
  );
}
