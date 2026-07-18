import {
  Sparkles,
  Keyboard,
  Zap,
  LayoutDashboard,
  StickyNote,
  Code2,
  BrainCircuit,
  BookOpen,
  Target,
  CalendarDays,
  Inbox as InboxIcon,
  Share2,
  Settings as SettingsIcon,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";

export type TourStepPlacement = "center" | "right" | "left" | "bottom" | "top";

export interface TourStep {
  /** `data-tour` attribute to look for on the highlighted element. Undefined = centered modal. */
  target?: string;
  /** Fallback placement if the target is not in the DOM right now. */
  placement: TourStepPlacement;
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Optional extra hint shown under the description (e.g. a keyboard combo).
   * Keys are rendered platform-aware: "mod" → ⌘/Ctrl, "shift" → ⇧/Shift,
   * "alt" → ⌥/Alt, anything else is shown as-is.
   */
  hint?: { label: string; keys: ("mod" | "shift" | "alt" | string)[] };
}

/**
 * Order matters. Each step highlights one UI element and explains what it does.
 * Sidebar items use the "right" placement so the card sits next to the sidebar.
 */
export const tourSteps: TourStep[] = [
  {
    placement: "center",
    icon: Sparkles,
    title: "Welcome to oNote 👋",
    description:
      "A knowledge vault for programmers. Skills, notes, snippets, and reviews — all in one place. Let's walk through the UI.",
  },
  {
    target: "sidebar-item-dashboard",
    placement: "right",
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Your daily overview: pending reviews, current streak, recent notes, today's journal, and a snapshot of your top skills.",
  },
  {
    target: "sidebar-item-skills",
    placement: "right",
    icon: Sparkles,
    title: "Skills",
    description:
      "Track what you know — languages, frameworks, tools, concepts — with a 1-5 level. Each skill runs on its own spaced-repetition schedule.",
  },
  {
    target: "sidebar-item-notes",
    placement: "right",
    icon: StickyNote,
    title: "Notes",
    description:
      "Markdown knowledge base with syntax highlighting, tags, and backlinks. Open one to see the full editor.",
  },
  {
    target: "sidebar-item-snippets",
    placement: "right",
    icon: Code2,
    title: "Snippets",
    description:
      "Searchable code library. Tag by language and topic so you can find that one regex you wrote six months ago in two seconds.",
  },
  {
    target: "sidebar-item-review",
    placement: "right",
    icon: BrainCircuit,
    title: "Review",
    description:
      "Spaced-repetition queue. Skills show up here when they're due — the badge on the left counts today's pending reviews.",
  },
  {
    target: "sidebar-item-resources",
    placement: "right",
    icon: BookOpen,
    title: "Resources",
    description:
      "Articles, videos, courses, books. Track them with a status: to-read, in-progress, or done.",
  },
  {
    target: "sidebar-item-projects",
    placement: "right",
    icon: Target,
    title: "Projects",
    description:
      "Goals and side-projects you're building. Link skills to projects to see what each one is teaching you.",
  },
  {
    target: "sidebar-item-daily",
    placement: "right",
    icon: CalendarDays,
    title: "Daily",
    description:
      "A journal per day. Use it for standups, postmortems, or just braindumps. One entry per date.",
  },
  {
    target: "sidebar-item-inbox",
    placement: "right",
    icon: InboxIcon,
    title: "Inbox",
    description:
      "Quick capture lands here. Drop anything in, sort it into the right section later. The badge shows what's unprocessed.",
  },
  {
    target: "sidebar-item-graph",
    placement: "right",
    icon: Share2,
    title: "Graph",
    description:
      "A visual map of how your notes, skills, and projects connect. Great for spotting gaps in your knowledge.",
  },
  {
    target: "sidebar-item-settings",
    placement: "right",
    icon: SettingsIcon,
    title: "Settings",
    description:
      "Export / import your data, replay this tour, toggle layout direction, and see your unlocked achievements.",
  },
  {
    target: "command-palette-trigger",
    placement: "bottom",
    icon: Keyboard,
    title: "Command palette",
    description:
      "From anywhere in the app, search anything — notes, snippets, skills — or jump straight to a page.",
    hint: { label: "Press", keys: ["mod", "k"] },
  },
  {
    target: "quick-capture",
    placement: "bottom",
    icon: Zap,
    title: "Quick capture",
    description:
      "Dump a thought, link, or idea here. It goes to Inbox. There's also a global shortcut that works from any other app.",
    hint: { label: "In app", keys: ["mod", "shift", "a"] },
  },
  {
    target: "dashboard-greeting",
    placement: "bottom",
    icon: LayoutDashboard,
    title: "The greeting card",
    description:
      "Same dashboard as before, but this is the most important widget: what to do next.",
  },
  {
    placement: "center",
    icon: PartyPopper,
    title: "You're all set 🎉",
    description:
      "Go add your first Skill and let spaced repetition start reminding you to review. Replay this tour any time from Settings.",
  },
];
