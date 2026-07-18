// Global Zustand store for UI state (not data — data is per-page).
// We import `create` via a local shim wrapper that avoids the
// zustand main entry's `export * from "zustand/react"` re-exports
// (which Rollup drops under `sideEffects: false`). The shim
// implements the subset of Zustand we use; semantics are identical.
import { create } from "@/lib/store-shim";
import { listen } from "@tauri-apps/api/event";
import pkg from "../../package.json";

const APP_VERSION = pkg.version;

// localStorage keys — kept stable so upgrades don't lose user prefs.
const TOUR_LAST_SEEN_KEY = "onote.tour.lastSeenVersion";
const DIRECTION_KEY = "onote.direction";
const PLATFORM_KEY = "onote.platform";

export type Platform = "mac" | "windows" | "linux";

/** Best-effort auto-detect from the UA. Mac users get the right defaults
 *  even before the first-run modal closes. */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = (navigator.platform || "").toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore (private mode / storage disabled)
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Show the tour when we have no record of seeing it for THIS app version. */
function shouldShowTour(): boolean {
  return safeGet(TOUR_LAST_SEEN_KEY) !== APP_VERSION;
}

function markTourSeen() {
  safeSet(TOUR_LAST_SEEN_KEY, APP_VERSION);
}

function readDirection(): "ltr" | "rtl" {
  return safeGet(DIRECTION_KEY) === "rtl" ? "rtl" : "ltr";
}

function applyDocumentDirection(dir: "ltr" | "rtl") {
  if (typeof document !== "undefined") {
    document.documentElement.dir = dir;
  }
}

export interface UIState {
  commandPaletteOpen: boolean;
  quickCaptureOpen: boolean;
  setCommandPalette: (open: boolean) => void;
  setQuickCapture: (open: boolean) => void;
  toggleCommandPalette: () => void;
  toggleQuickCapture: () => void;

  toasts: { id: string; message: string; tone: "info" | "success" | "error" }[];
  pushToast: (message: string, tone?: "info" | "success" | "error") => void;
  dismissToast: (id: string) => void;

  // Onboarding tour
  tourOpen: boolean;
  tourStep: number;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: (markCompleted: boolean) => void;
  resetTour: () => void;

  // Layout direction (ltr / rtl). Toggled from Settings; persisted in localStorage.
  direction: "ltr" | "rtl";
  setDirection: (dir: "ltr" | "rtl") => void;

  // Platform pick (first-run). Persisted; user can change it from Settings.
  platform: Platform;
  /** True until the user has made an explicit choice in the picker. */
  platformPicked: boolean;
  setPlatform: (p: Platform) => void;

  init: () => void;
}

export const useUI = create<UIState>((set, get) => ({
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
  setQuickCapture: (open) => set({ quickCaptureOpen: open }),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleQuickCapture: () =>
    set((s) => ({ quickCaptureOpen: !s.quickCaptureOpen })),

  toasts: [],
  pushToast: (message, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  tourOpen: false,
  tourStep: 0,
  startTour: () => {
    set({ tourOpen: true, tourStep: 0 });
    // Helpful when debugging: the user can open DevTools and see this fired.
    console.log("[onote] tour started");
  },
  nextTourStep: () => set((s) => ({ tourStep: s.tourStep + 1 })),
  prevTourStep: () => set((s) => ({ tourStep: Math.max(0, s.tourStep - 1) })),
  endTour: (markCompleted) => {
    if (markCompleted) markTourSeen();
    set({ tourOpen: false, tourStep: 0 });
  },
  resetTour: () => {
    safeRemove(TOUR_LAST_SEEN_KEY);
    set({ tourOpen: true, tourStep: 0 });
    console.log("[onote] tour reset & started");
  },

  direction: readDirection(),
  setDirection: (dir) => {
    safeSet(DIRECTION_KEY, dir);
    applyDocumentDirection(dir);
    set({ direction: dir });
  },

  platform: ((): Platform => {
    const raw = safeGet(PLATFORM_KEY);
    if (raw === "mac" || raw === "windows" || raw === "linux") return raw;
    return detectPlatform();
  })(),
  platformPicked: safeGet(PLATFORM_KEY) === "mac"
    || safeGet(PLATFORM_KEY) === "windows"
    || safeGet(PLATFORM_KEY) === "linux",
  setPlatform: (p) => {
    safeSet(PLATFORM_KEY, p);
    set({ platform: p, platformPicked: true });
  },

  init: () => {
    // Apply the persisted direction on the <html> element before first paint
    // of any text. Without this, mixed Persian/English content would render LTR
    // until something else toggled it.
    applyDocumentDirection(get().direction);

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      // Ctrl/Cmd + K -> command palette
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        get().toggleCommandPalette();
      }
      // Ctrl/Cmd + Shift + A -> quick capture
      if (mod && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        get().toggleQuickCapture();
      }
      // Ctrl/Cmd + / -> focus search (handled in pages)
      if (mod && e.key === "/") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>("[data-search-input]");
        el?.focus();
      }
    });

    // Listen to quick-capture event from global shortcut
    listen("quick-capture", () => {
      get().setQuickCapture(true);
    });

    // Manual trigger: anyone (e.g. DevTools, future menu item) can dispatch
    //   window.dispatchEvent(new Event("onote:start-tour"))
    // to open the tour without resetting the "last seen" flag.
    window.addEventListener("onote:start-tour", () => {
      get().startTour();
    });

    // Hard reset: same idea, but also clears the last-seen marker so the next
    // launch shows the tour again.
    window.addEventListener("onote:reset-tour", () => {
      get().resetTour();
    });

    // URL hash trigger — great for testing or sharing a link.
    // Open the app with #tour in the URL to force the tour open.
    if (window.location.hash === "#tour") {
      setTimeout(() => get().startTour(), 50);
    }

    // First-run: open the tour automatically when the user hasn't seen it
    // for this app version. We wait long enough for the layout to settle and
    // for the dashboard's data-tour targets to actually be in the DOM.
    if (shouldShowTour()) {
      setTimeout(() => {
        if (shouldShowTour()) {
          get().startTour();
        }
      }, 900);
    }
  },
}));
