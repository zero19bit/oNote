import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Sparkles,
  StickyNote,
  Code2,
  BrainCircuit,
  BookOpen,
  Target,
  CalendarDays,
  Inbox as InboxIcon,
  Share2,
  Settings as SettingsIcon,
  Code2 as GithubIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getStats } from "@/lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: () => number | null;
}

export function Sidebar() {
  const location = useLocation();
  const [due, setDue] = useState<number | null>(null);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const stats = await getStats();
        if (alive) setDue(stats.due_today);
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Listen for inbox events
  useEffect(() => {
    const handler = () => {
      import("@/lib/api").then(async (m) => {
        try {
          const items = await m.listInbox(true);
          setInboxCount(items.length);
        } catch {}
      });
    };
    window.addEventListener("inbox:changed", handler);
    handler();
    return () => window.removeEventListener("inbox:changed", handler);
  }, []);

  const items: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/skills", label: "Skills", icon: Sparkles },
    { to: "/notes", label: "Notes", icon: StickyNote },
    { to: "/snippets", label: "Snippets", icon: Code2 },
    { to: "/review", label: "Review", icon: BrainCircuit, badge: () => due },
    { to: "/resources", label: "Resources", icon: BookOpen },
    { to: "/projects", label: "Projects", icon: Target },
    { to: "/daily", label: "Daily", icon: CalendarDays },
    {
      to: "/inbox",
      label: "Inbox",
      icon: InboxIcon,
      badge: () => inboxCount,
    },
    { to: "/graph", label: "Graph", icon: Share2 },
  ];

  return (
    <aside className="w-60 shrink-0 h-full border-r border-border bg-bg-surface flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/onote-icon.png" alt="oNote" className="w-8 h-8 rounded-lg object-cover" />
          <div>
            <div className="font-semibold text-sm leading-tight">oNote</div>
            <div className="text-[10px] text-fg-muted uppercase tracking-wider">
              notes & syntax
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {items.map(({ to, label, icon: Icon, badge }) => {
          const active =
            to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(to);
          const b = badge?.() ?? null;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2 mx-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-bg-elevated text-fg"
                  : "text-fg-muted hover:text-fg hover:bg-bg-elevated/50"
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {b !== null && b > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-semibold rounded-full px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center",
                    to === "/review"
                      ? "bg-accent text-bg-base"
                      : "bg-brand-amber/20 text-brand-amber"
                  )}
                >
                  {b}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-bg-elevated text-fg"
                : "text-fg-muted hover:text-fg hover:bg-bg-elevated/50"
            )
          }
        >
          <SettingsIcon size={16} />
          <span>Settings</span>
        </NavLink>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-fg-subtle hover:text-fg-muted transition-colors"
        >
          <GithubIcon size={14} />
          <span className="text-xs">v0.1.0</span>
        </a>
      </div>
    </aside>
  );
}
