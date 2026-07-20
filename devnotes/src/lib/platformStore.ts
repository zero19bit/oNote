// Shared platform-persistence helpers used by:
//   - components/PlatformPicker/PlatformPicker.tsx  (first-run prompt)
//   - pages/Settings.tsx                            (change platform later)
//
// We persist via tauri-plugin-store (a JSON file in the app's per-user
// data dir) instead of localStorage. WebView2 in dev mode can drop
// localStorage between Tauri restarts, but plugin-store writes survive
// because they live on the filesystem in the app data dir.

import { load, type Store } from "@tauri-apps/plugin-store";
import type { Platform } from "@/store/ui";

const STORE_FILE = "settings.json";
const KEY = "platform";
const VALID: Platform[] = ["mac", "windows", "linux"];

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { defaults: {}, autoSave: true });
  }
  return storePromise;
}

/** Read the persisted platform. Returns `null` if the user has never
 *  picked. Falls back to localStorage when the Tauri store is not
 *  available (e.g. plain browser tab during development). */
export async function readPlatform(): Promise<Platform | null> {
  try {
    const s = await getStore();
    const v = await s.get<string>(KEY);
    if (VALID.includes(v as Platform)) return v as Platform;
  } catch {
    // fall through to localStorage
  }
  try {
    const raw = localStorage.getItem("onote.platform");
    if (VALID.includes(raw as Platform)) return raw as Platform;
  } catch {}
  return null;
}

/** Write the platform to the persistent store. Also mirrors to
 *  localStorage so the in-memory Zustand flag stays correct for
 *  the current session and as a backup for the browser case. */
export async function writePlatform(p: Platform): Promise<void> {
  try {
    localStorage.setItem("onote.platform", p);
  } catch {}
  try {
    const s = await getStore();
    await s.set(KEY, p);
    await s.save();
  } catch {
    // ignore — the in-memory state still keeps things consistent for
    // the rest of this session
  }
}
