// Achievement system — light gamification that fires on stats changes.
import { useUI } from "@/store/ui";
import { getStats, listAchievements, unlockAchievement } from "@/lib/api";

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

// Module-level state. Lives for the lifetime of the JS runtime — reset on
// every app launch, which is fine because we re-seed it from the DB below.
const unlockedCache = new Set<string>();
let initialized = false;
let timer: number | null = null;

/** Seed the cache from whatever's already in the DB so we don't re-fire
 *  toasts for achievements the user earned in a previous session. */
async function loadUnlockedFromDb(): Promise<void> {
  try {
    const existing = await listAchievements();
    for (const a of existing) unlockedCache.add(a.code);
  } catch {
    // If the DB read fails, just start with an empty cache; we'll
    // re-attempt on the next `achievement:recheck` event.
  }
}

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
          } catch {
            // If the DB write failed, drop the code from the cache so we
            // try again on the next check.
            unlockedCache.delete(a.code);
          }
        }
      }
    } catch {}
  };

  // Seed once, then start the polling loop. We do this lazily so that the
  // very first `check()` after init sees the up-to-date cache and doesn't
  // re-fire for already-earned achievements.
  if (!initialized) {
    initialized = true;
    loadUnlockedFromDb().then(check);
  } else {
    check();
  }

  if (timer) clearInterval(timer);
  timer = window.setInterval(check, 30_000);

  // Also re-check on demand
  window.addEventListener("achievement:recheck", check);
}
