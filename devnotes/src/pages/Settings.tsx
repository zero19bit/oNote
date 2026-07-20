import { useEffect, useState } from "react";
import { Download, Upload, Trash2, Trophy, Database, Keyboard, Info, HelpCircle, Languages, RotateCcw, Apple, Monitor, Terminal } from "lucide-react";
import {
  listSkills,
  listNotes,
  listSnippets,
  listResources,
  listProjects,
  listDailyEntries,
  listInbox,
  listAchievements,
} from "@/lib/api";
import { useUI, type Platform } from "@/store/ui";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { writePlatform } from "@/lib/platformStore";
import { cn, shortcutKeys } from "@/lib/utils";

export function Settings() {
  const [counts, setCounts] = useState<any>({});
  const [achievements, setAchievements] = useState<any[]>([]);
  const pushToast = useUI((s) => s.pushToast);
  const startTour = useUI((s) => s.startTour);
  const resetTour = useUI((s) => s.resetTour);
  const direction = useUI((s) => s.direction);
  const setDirection = useUI((s) => s.setDirection);
  const platform = useUI((s) => s.platform);
  const setPlatform = useUI((s) => s.setPlatform);

  // Shortcut definitions — one source of truth, rendered platform-aware.
  const shortcuts: Array<{ label: string; parts: ("mod" | "shift" | "alt" | string)[] }> = [
    { label: "Command palette",         parts: ["mod", "k"] },
    { label: "Quick capture (in app)",  parts: ["mod", "shift", "a"] },
    { label: "Quick capture (global)",  parts: ["mod", "shift", "space"] },
    { label: "Focus search",            parts: ["mod", "/"] },
    { label: "New (context-aware)",     parts: ["Topbar + button"] },
  ];

  useEffect(() => {
    (async () => {
      const [s, n, sn, r, p, d, i, a] = await Promise.all([
        listSkills(),
        listNotes(true),
        listSnippets(),
        listResources(),
        listProjects(),
        listDailyEntries(1000),
        listInbox(false),
        listAchievements(),
      ]);
      setCounts({ skills: s.length, notes: n.length, snippets: sn.length, resources: r.length, projects: p.length, daily: d.length, inbox: i.length });
      setAchievements(a);
    })();
  }, []);

  const exportData = async () => {
    try {
      const [s, n, sn, r, p, d, i] = await Promise.all([
        listSkills(), listNotes(true), listSnippets(), listResources(),
        listProjects(), listDailyEntries(1000), listInbox(false),
      ]);
      const data = {
        version: "0.1.0",
        exported_at: new Date().toISOString(),
        skills: s, notes: n, snippets: sn, resources: r, projects: p, daily: d, inbox: i,
      };
      const path = await saveDialog({
        title: "Export DevNotes data",
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: `devnotes-export-${new Date().toISOString().slice(0, 10)}.json`,
      });
      if (!path) return;
      await writeTextFile(path, JSON.stringify(data, null, 2));
      pushToast("Exported successfully", "success");
    } catch (e: any) {
      pushToast(e?.message ?? "Export failed", "error");
    }
  };

  const importData = async () => {
    try {
      const path = await openDialog({
        title: "Import DevNotes data",
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!path || Array.isArray(path)) return;
      const text = await readTextFile(path);
      const data = JSON.parse(text);
      // Simple merge: re-insert with new IDs
      const { createSkill, createNote, createSnippet, createResource, createProject } = await import("@/lib/api");
      let imported = 0;
      for (const s of data.skills ?? []) {
        await createSkill({ ...s, id: undefined });
        imported++;
      }
      for (const n of data.notes ?? []) {
        await createNote({ ...n, id: undefined });
        imported++;
      }
      for (const sn of data.snippets ?? []) {
        await createSnippet({ ...sn, id: undefined });
        imported++;
      }
      for (const r of data.resources ?? []) {
        await createResource({ ...r, id: undefined });
        imported++;
      }
      for (const p of data.projects ?? []) {
        await createProject({ ...p, id: undefined });
        imported++;
      }
      pushToast(`Imported ${imported} items`, "success");
    } catch (e: any) {
      pushToast(e?.message ?? "Import failed", "error");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Section icon={Database} title="Data" subtitle="Your data is stored locally in SQLite at app data dir.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="surface p-3">
              <div className="text-[10px] text-fg-muted uppercase tracking-wider">{k}</div>
              <div className="text-xl font-bold">{v as any}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={exportData} className="btn-primary">
            <Download size={14} /> Export all (JSON)
          </button>
          <button onClick={importData} className="btn-outline">
            <Upload size={14} /> Import from JSON
          </button>
        </div>
      </Section>

      <Section icon={Keyboard} title="Keyboard shortcuts" subtitle="Work faster.">
        <div className="space-y-1.5 text-sm">
          {shortcuts.map((s) => {
            if (s.parts[0] === "Topbar + button") {
              return (
                <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-fg-muted">{s.label}</span>
                  <span className="text-fg-subtle text-xs">Topbar + button</span>
                </div>
              );
            }
            const keys = shortcutKeys(platform, ...s.parts as any);
            return (
              <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-fg-muted">{s.label}</span>
                <span className="flex items-center gap-1">
                  {keys.map((k, i) => (
                    <span key={i} className="kbd">{k}</span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-fg-subtle mt-2">
          Showing shortcuts for <span className="text-fg-muted">{platform === "mac" ? "macOS" : platform === "linux" ? "Linux" : "Windows"}</span>. Change below if needed.
        </p>
      </Section>

      <Section icon={Monitor} title="Platform" subtitle="Shortcuts adapt to your OS">
        <p className="text-sm text-fg-muted mb-3">
          Pick the OS you use so we render the right key glyphs (⌘ on Mac, Ctrl elsewhere).
          This only affects how shortcuts look — the actual keys still work either way.
        </p>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {([
            { p: "mac" as Platform,     label: "macOS",   Icon: Apple },
            { p: "windows" as Platform, label: "Windows", Icon: Monitor },
            { p: "linux" as Platform,   label: "Linux",   Icon: Terminal },
          ]).map(({ p, label, Icon }, i) => (
            <button
              key={p}
              onClick={() => {
                setPlatform(p);
                writePlatform(p); // persist to plugin-store so the picker stays hidden next launch
                pushToast(`Shortcuts set for ${label}`, "success");
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
                i > 0 && "border-l border-border",
                platform === p
                  ? "bg-accent text-bg-base"
                  : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
              )}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Trophy} title="Achievements" subtitle="Light gamification to keep you consistent.">
        {achievements.length === 0 ? (
          <p className="text-sm text-fg-muted">No achievements unlocked yet. Keep going!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {achievements.map((a) => (
              <div key={a.id} className="surface p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-brand-purple flex items-center justify-center shrink-0">
                  <Trophy size={14} className="text-bg-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-[11px] text-fg-muted">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={HelpCircle} title="Onboarding tour" subtitle="A step-by-step guide to oNote's UI">
        <p className="text-sm text-fg-muted mb-3">
          Already finished the tour or want a refresher? Replay it any time to see what's where.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              startTour();
              pushToast("Tour started", "info");
            }}
            className="btn-outline"
          >
            <HelpCircle size={14} />
            Replay tour
          </button>
          <button
            onClick={() => {
              resetTour();
              pushToast("Tour reset — it will also show on next launch", "success");
            }}
            className="btn-outline"
          >
            <RotateCcw size={14} />
            Reset & replay
          </button>
        </div>
      </Section>

      <Section
        icon={Languages}
        title="Layout direction"
        subtitle="Switch between left-to-right and right-to-left for mixed-language content"
      >
        <p className="text-sm text-fg-muted mb-3">
          Most of the app is LTR, but enabling RTL helps when you write or paste Persian/Arabic text and want it to flow naturally.
        </p>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => {
              setDirection("ltr");
              pushToast("Direction: LTR", "info");
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-medium transition-colors",
              direction === "ltr"
                ? "bg-accent text-bg-base"
                : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
            )}
          >
            LTR
          </button>
          <button
            onClick={() => {
              setDirection("rtl");
              pushToast("Direction: RTL", "info");
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-medium transition-colors border-l border-border",
              direction === "rtl"
                ? "bg-accent text-bg-base"
                : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
            )}
          >
            RTL
          </button>
        </div>
        <p className="text-[11px] text-fg-subtle mt-2">
          Current: <span className="font-mono text-fg-muted">{direction.toUpperCase()}</span> · Saved to localStorage
        </p>
      </Section>

      <Section icon={Info} title="About" subtitle="DevNotes — a knowledge vault for programmers.">
        <p className="text-sm text-fg-muted">
          Built with Tauri 2, React, TypeScript, and SQLite. Your data stays on your machine.
          Cross-platform: Linux & Windows.
        </p>
        <div className="text-xs text-fg-subtle mt-3 space-y-0.5">
          <div>Version: 0.1.0</div>
          <div>License: MIT</div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Info;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-accent/20 text-accent flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-fg-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
