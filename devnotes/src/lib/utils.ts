// Utility helpers used across the app.
export const cn = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "never";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / 1000); // seconds
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
  return `${Math.floor(diff / (86400 * 365))}y ago`;
};

export const todayString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const uuid = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
};

export const truncate = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";

export const levelLabel = (lvl: number): string =>
  ["Novice", "Beginner", "Intermediate", "Advanced", "Expert"][
    Math.max(0, Math.min(4, lvl - 1))
  ];

export const levelColor = (lvl: number): string =>
  ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"][
    Math.max(0, Math.min(4, lvl - 1))
  ];

/** Platform-aware key labels. Use these everywhere a shortcut is shown so the
 *  displayed text matches what the user actually presses. */
export const isMacPlatform = (p: "mac" | "windows" | "linux") => p === "mac";

/** Returns "⌘" on Mac, "Ctrl" elsewhere. */
export const cmdKey = (p: "mac" | "windows" | "linux") => (isMacPlatform(p) ? "⌘" : "Ctrl");

/** Returns "⌥" on Mac, "Alt" elsewhere. */
export const optKey = (p: "mac" | "windows" | "linux") => (isMacPlatform(p) ? "⌥" : "Alt");

/** Returns "⇧" on Mac, "Shift" elsewhere. */
export const shiftKey = (p: "mac" | "windows" | "linux") => (isMacPlatform(p) ? "⇧" : "Shift");

/** Builds a sequence of kbd labels for a chord. Pass the keys in reading order
 *  and the function picks the right glyph per platform.
 *  Example: `shortcutKeys("mac", "mod", "shift", "a")` → ["⌘", "⇧", "A"] */
export const shortcutKeys = (
  p: "mac" | "windows" | "linux",
  ...parts: ("mod" | "shift" | "alt" | string)[]
): string[] => {
  return parts.map((p2) => {
    const k = p2.toLowerCase();
    if (k === "mod") return cmdKey(p);
    if (k === "shift") return shiftKey(p);
    if (k === "alt") return optKey(p);
    // Letters get uppercased on Mac, "Shift+A" style elsewhere.
    if (k.length === 1 && /[a-z]/.test(k)) {
      return isMacPlatform(p) ? k.toUpperCase() : k.toUpperCase();
    }
    return p2;
  });
};
