// Achievement system — light gamification that fires on stats changes.
import { useUI } from "@/store/ui";
import { getStats, unlockAchievement } from "@/lib/api";

interface Achievement {
  code: string;
  title: string;
  description: string;
  check: (s: Awaited<ReturnType<typeof getStats>>) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { code: "first_note", title: "First Note", description: "Created your first note", check: (s) => s.total_notes >= 1 },
  { code: "ten_notes", title: "Note Taker", description: "10 notes saved", check: (s) => s.total_notes >= 10 },
  { code: "hundred_notes", title: "Lore Master", description: "100 notes saved", check: (s) => s.total_notes >= 100 },
  { code: "first_skill", title: "Skill Listed", description: "Added your first skill", check: (s) => s.total_skills >= 1 },
  { code: "ten_skills", title: "Polyglot Aspirant", description: "10 skills tracked", check: (s) => s.total_skills >= 10 },
  { code: "first_snippet", title: "Snippet Saved", description: "Saved your first snippet", check: (s) => s.total_snippets >= 1 },
  { code: "first_review", title: "Memory Workout", description: "Completed your first review", check: (s) => s.total_reviews >= 1 },
  { code: "streak_3", title: "3-Day Streak", description: "Reviewed 3 days in a row", check: (s) => s.streak_days >= 3 },
  { code: "streak_7", title: "Weekly Habit", description: "Reviewed 7 days in a row", check: (s) => s.streak_days >= 7 },
  { code: "streak_30", title: "Iron Memory", description: "30-day review streak", check: (s) => s.streak_days >= 30 },
];

const unlockedCache = new Set<string>();
let timer: number | null = null;

export function initAchievementWatchers() {
  const pushToast = useUI.getState().pushToast;

  const check = async () => {
    try {
      const stats = await getStats();
      for (const a of ACHIEVEMENTS) {
        if (unlockedCache.has(a.code)) continue;
        if (a.check(stats)) {
          unlockedCache.add(a.code);
          try {
            await unlockAchievement(a.code, a.title, a.description);
            window.dispatchEvent(
              new CustomEvent("achievement:unlocked", { detail: a })
            );
            pushToast(`🏆 ${a.title}`, "success");
          } catch {}
        }
      }
    } catch {}
  };

  // Initial check + every 30s
  check();
  if (timer) clearInterval(timer);
  timer = window.setInterval(check, 30_000);

  // Also re-check on demand
  window.addEventListener("achievement:recheck", check);
}
