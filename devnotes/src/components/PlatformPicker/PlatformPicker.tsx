import { useEffect, useState } from "react";
import { Apple, Monitor, Terminal, Keyboard } from "lucide-react";
import { useUI, type Platform } from "@/store/ui";
import { cn } from "@/lib/utils";
import { readPlatform, writePlatform } from "@/lib/platformStore";

const PLATFORM_META: Record<Platform, { label: string; sub: string; Icon: typeof Apple; sample: string[] }> = {
  mac:     { label: "macOS",     sub: "⌘  to open commands",  Icon: Apple,    sample: ["⌘", "K"] },
  windows: { label: "Windows",   sub: "Ctrl to open commands", Icon: Monitor,  sample: ["Ctrl", "K"] },
  linux:   { label: "Linux",     sub: "Ctrl to open commands", Icon: Terminal, sample: ["Ctrl", "K"] },
};

/**
 * One-shot first-run prompt that asks the user which OS they're on so we
 * can render shortcuts in the right style (⌘ on Mac, Ctrl elsewhere).
 * The user can change their answer any time from Settings.
 *
 * Persistence: the platform is read from / written to `tauri-plugin-store`,
 * a JSON file in the app's per-user data dir. We deliberately avoid
 * localStorage because WebView2 in dev mode can drop it between Tauri
 * restarts.
 */
export function PlatformPicker() {
  const platform = useUI((s) => s.platform);
  const storePicked = useUI((s) => s.platformPicked);
  const setPlatform = useUI((s) => s.setPlatform);
  const pushToast = useUI((s) => s.pushToast);

  // `null`  = still loading from the persistent store
  // `true`  = the user has already picked (hide the picker)
  // `false` = no pick yet (show the picker)
  const [hasPicked, setHasPicked] = useState<boolean | null>(null);

  // Read on mount from the persistent store. We do this even though the
  // Zustand store also reads localStorage at init — the store's value
  // could be stale (e.g. user changed platform via Settings in a
  // previous session) and only the plugin-store is the source of truth.
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await readPlatform();
      if (!alive) return;
      if (stored) {
        // Sync the in-memory Zustand state so the rest of the app sees it.
        if (!storePicked || useUI.getState().platform !== stored) {
          setPlatform(stored);
        }
        setHasPicked(true);
      } else {
        setHasPicked(false);
      }
    })();
    return () => {
      alive = false;
    };
    // We intentionally don't depend on storePicked / platform here —
    // re-running this every time they change would loop with the
    // setHasPicked → setPlatform cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc dismisses the picker without saving (treats it as a no-op;
  // next launch will ask again).
  useEffect(() => {
    if (hasPicked !== false) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        pushToast("Pick your platform later from Settings → Keyboard", "info");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPicked, pushToast]);

  if (hasPicked !== false) return null;

  const choose = (p: Platform) => {
    setPlatform(p);            // updates Zustand + localStorage
    setHasPicked(true);
    writePlatform(p);          // primary: persistent plugin-store file
    pushToast(`Shortcuts set for ${PLATFORM_META[p].label}`, "success");
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[560px] max-w-full surface-elevated shadow-card">
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/20 text-accent flex items-center justify-center mx-auto mb-3">
            <Keyboard size={20} />
          </div>
          <h2 className="text-lg font-semibold">Which OS are you on?</h2>
          <p className="text-xs text-fg-muted mt-1 max-w-md mx-auto">
            We'll show keyboard shortcuts in the right style for your machine
            — <span className="kbd">⌘</span> on Mac, <span className="kbd">Ctrl</span> on Windows & Linux.
            You can change this later in Settings.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 p-6">
          {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
            const meta = PLATFORM_META[p];
            const Icon = meta.Icon;
            const active = platform === p;
            return (
              <button
                key={p}
                onClick={() => choose(p)}
                className={cn(
                  "group surface p-4 text-center hover:border-accent/60 transition-colors",
                  active && "border-accent/50 bg-accent/5"
                )}
              >
                <Icon size={22} className="mx-auto mb-2 text-fg-muted group-hover:text-accent" />
                <div className="font-semibold text-sm">{meta.label}</div>
                <div className="text-[11px] text-fg-muted mt-0.5">{meta.sub}</div>
                <div className="flex items-center justify-center gap-1 mt-3">
                  {meta.sample.map((k, i) => (
                    <span key={i} className="kbd">{k}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-6 pb-5 text-center">
          <p className="text-[11px] text-fg-subtle">
            Esc to skip — we&apos;ll ask again next time.
          </p>
        </div>
      </div>
    </div>
  );
}
