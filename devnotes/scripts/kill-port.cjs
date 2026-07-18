#!/usr/bin/env node
// Cross-platform helper that frees a TCP port before `npm run dev` or
// `npm run tauri:dev` starts. If anything is wrong (missing powershell
// on non-Windows, permission errors, …) we just log and exit 0 — the
// subsequent dev command will produce a clearer error if the port is
// still in use.

const { execSync } = require("node:child_process");
const port = process.argv[2];
if (!port) {
  console.error("[kill-port] usage: node scripts/kill-port.cjs <port>");
  process.exit(0);
}

const isWindows = process.platform === "win32";

try {
  if (isWindows) {
    // Find PIDs listening on the port via Get-NetTCPConnection, then
    // stop them with Stop-Process. Both are PowerShell-only, but the
    // project is Windows-only (Tauri + Vite + react), so that's fine.
    const ps = `
      $conns = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue;
      $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique;
      foreach ($p in $pids) {
        try { Stop-Process -Id $p -Force -ErrorAction Stop; Write-Output "[kill-port] killed $p on :${port}" } catch {}
      }
    `;
    execSync(`powershell -NoProfile -Command "${ps.replace(/\n\s+/g, " ")}"`, {
      stdio: "inherit",
    });
  } else {
    // POSIX: fuser -k <port>/tcp  → kills anything bound to the port.
    execSync(`fuser -k ${port}/tcp || true`, { stdio: "inherit" });
  }
} catch (e) {
  // Never fail the dev script because of a kill-port hiccup. The
  // npm `predev` / `pretauri:dev` hook should always succeed.
  console.warn(`[kill-port] could not free :${port} (${e.message})`);
}
