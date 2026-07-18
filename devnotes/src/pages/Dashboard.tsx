import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  StickyNote,
  Code2,
  BrainCircuit,
  BookOpen,
  Target,
  Flame,
  TrendingUp,
  Inbox as InboxIcon,
  ArrowRight,
  CalendarDays,
  Zap,
} from "lucide-react";
import { getStats, listDailyEntries, listInbox, listSkills, listNotes, ReviewStats } from "@/lib/api";
import { cn, formatDate, relativeTime, todayString } from "@/lib/utils";

const Stat = ({
  icon: Icon,
  label,
  value,
  hint,
  to,
  accent,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number | string;
  hint?: string;
  to: string;
  accent?: string;
}) => (
  <Link
    to={to}
    className="surface p-4 hover:border-border-strong transition-colors group"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accent ?? "bg-bg-elevated text-accent")}>
        <Icon size={16} />
      </div>
      <ArrowRight size={14} className="text-fg-subtle group-hover:text-accent transition-colors" />
    </div>
    <div className="text-2xl font-bold mb-0.5">{value}</div>
    <div className="text-xs text-fg-muted">{label}</div>
    {hint && <div className="text-[10px] text-fg-subtle mt-1">{hint}</div>}
  </Link>
);

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [inbox, setInbox] = useState<number>(0);
  const [dueNow, setDueNow] = useState(0);
  const [topSkills, setTopSkills] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [today, setToday] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, ib, dn, sk, nt] = await Promise.all([
          getStats(),
          listInbox(true),
          import("@/lib/api").then((m) => m.getDueForReview(5)),
          listSkills(),
          listNotes(),
        ]);
        setStats(s);
        setInbox(ib.length);
        setDueNow(dn.length);
        setTopSkills([...sk].sort((a, b) => b.level - a.level).slice(0, 5));
        setRecentNotes(nt.slice(0, 5));

        const d = await listDailyEntries(7);
        const t = todayString();
        setToday(d.find((x) => x.date === t) ?? null);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (!stats) {
    return (
      <div className="p-8 text-fg-muted text-sm">Loading dashboard...</div>
    );
  }

  const max7 = Math.max(1, ...stats.last_7_days_reviews.map((x) => x[1]));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Greeting */}
      <div
        data-tour="dashboard-greeting"
        className="surface-elevated p-6 bg-grid-fade relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
        <div className="relative">
          <div className="text-xs text-fg-muted uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {stats.due_today > 0
              ? `${stats.due_today} skill${stats.due_today > 1 ? "s" : ""} waiting for review`
              : "All caught up on reviews 🎉"}
          </h2>
          <p className="text-sm text-fg-muted">
            {stats.streak_days > 0
              ? `You're on a ${stats.streak_days}-day streak. Keep it going.`
              : "Start a review to begin your streak."}
          </p>

          <div className="flex gap-2 mt-4">
            <button onClick={() => navigate("/review")} className="btn-primary">
              <BrainCircuit size={14} />
              {stats.due_today > 0 ? "Start Review" : "Review anyway"}
            </button>
            <button onClick={() => navigate("/daily")} className="btn-outline">
              <CalendarDays size={14} />
              {today ? "Open today's journal" : "Daily journal"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Sparkles} label="Skills tracked" value={stats.total_skills} to="/skills" />
        <Stat icon={StickyNote} label="Notes" value={stats.total_notes} to="/notes" />
        <Stat icon={Code2} label="Snippets" value={stats.total_snippets} to="/snippets" />
        <Stat icon={BookOpen} label="Resources" value={stats.total_resources} to="/resources" />
        <Stat icon={Flame} label="Review streak" value={`${stats.streak_days}d`} to="/review" accent="bg-orange-500/20 text-orange-300" />
        <Stat icon={BrainCircuit} label="Reviews done" value={stats.total_reviews} to="/review" />
        <Stat icon={Target} label="In review queue" value={stats.due_today} to="/review" accent="bg-accent/20 text-accent" />
        <Stat icon={InboxIcon} label="Inbox items" value={inbox} to="/inbox" accent="bg-brand-amber/20 text-brand-amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Last 7 days chart */}
        <div className="surface p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Reviews — last 7 days</h3>
            <TrendingUp size={14} className="text-fg-muted" />
          </div>
          <div className="flex items-end gap-2 h-40">
            {stats.last_7_days_reviews.map(([date, count]) => {
              const h = (count / max7) * 100;
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-fg-muted font-mono">{count}</div>
                  <div className="w-full bg-bg-elevated rounded-md overflow-hidden flex-1 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-accent/30 to-accent rounded-md transition-all"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-fg-subtle font-mono">
                    {date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill radar (simple bars) */}
        <div className="surface p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Top skills</h3>
            <Link to="/skills" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {topSkills.length === 0 && (
              <div className="text-xs text-fg-muted text-center py-6">
                No skills yet. <Link to="/skills" className="text-accent hover:underline">Add one →</Link>
              </div>
            )}
            {topSkills.map((s) => (
              <Link
                key={s.id}
                to={`/skills/${s.id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-bg-elevated"
              >
                <div
                  className="w-2 h-8 rounded-full"
                  style={{ background: s.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-fg-muted uppercase">{s.category}</div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 h-4 rounded-sm",
                        i <= s.level ? "bg-accent" : "bg-bg-elevated"
                      )}
                    />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent notes */}
        <div className="surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Recent notes</h3>
            <Link to="/notes" className="text-xs text-accent hover:underline">All notes</Link>
          </div>
          <div className="space-y-1">
            {recentNotes.length === 0 && (
              <div className="text-xs text-fg-muted text-center py-6">
                No notes yet. <Link to="/notes" className="text-accent hover:underline">Start one →</Link>
              </div>
            )}
            {recentNotes.map((n) => (
              <Link
                key={n.id}
                to={`/notes/${n.id}`}
                className="block p-2 rounded-md hover:bg-bg-elevated"
              >
                <div className="text-sm font-medium truncate">{n.title}</div>
                <div className="text-[11px] text-fg-muted">{relativeTime(n.updated_at)}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Daily check-in */}
        <div className="surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Today</h3>
            <Link to="/daily" className="text-xs text-accent hover:underline">Open</Link>
          </div>
          {today ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} className="text-fg-muted" />
                <span className="text-xs text-fg-muted">{formatDate(today.date)}</span>
                <span className="chip">{today.kind}</span>
              </div>
              <p className="text-sm text-fg-muted line-clamp-4 whitespace-pre-wrap">
                {today.content || "Empty — go write something."}
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <Zap size={24} className="text-accent mx-auto mb-2" />
              <p className="text-sm text-fg-muted mb-3">No journal entry for today yet.</p>
              <Link to="/daily" className="btn-primary inline-flex">
                Start journaling
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
