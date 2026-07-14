// Global Zustand store for UI state (not data — data is per-page).
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";

interface UIState {
  commandPaletteOpen: boolean;
  quickCaptureOpen: boolean;
  setCommandPalette: (open: boolean) => void;
  setQuickCapture: (open: boolean) => void;
  toggleCommandPalette: () => void;
  toggleQuickCapture: () => void;

  toasts: { id: string; message: string; tone: "info" | "success" | "error" }[];
  pushToast: (message: string, tone?: "info" | "success" | "error") => void;
  dismissToast: (id: string) => void;

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

  init: () => {
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
  },
}));
