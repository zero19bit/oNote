# DevNotes

> A knowledge vault for programmers — track skills, capture notes, store snippets, and review what you learn.

DevNotes is a cross-platform (Linux & Windows) desktop app built with Tauri 2 + React + TypeScript + SQLite.

---

## Prerequisites

### Windows
- **Node.js ≥ 18** — https://nodejs.org
- **Rust ≥ 1.77** — install via [rustup](https://rustup.rs/) (select the `msvc` toolchain)
- **Microsoft Visual Studio C++ Build Tools** — install with the "Desktop development with C++" workload
- **WebView2 Runtime** — pre-installed on Windows 10/11; otherwise grab it from Microsoft

Verify with:
```powershell
node --version
rustc --version
cargo --version
```

### Linux (Debian / Ubuntu)
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install system deps
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config
```

### Linux (Fedora / RHEL)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl wget file \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  gcc gcc-c++ make
```

### macOS (bonus)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
xcode-select --install
```

---

## Run in development

```bash
cd devnotes
npm install        # downloads ~140 MB of node_modules
npm run tauri:dev  # compiles Rust backend (first run: 5-10 min) + launches app
```

The first `tauri:dev` run downloads ~570 Rust crates and compiles them — grab a coffee. After that, hot-reload is fast for the React side; Rust recompiles in seconds when you change a `.rs` file.

---

## Build a release binary

```bash
npm run tauri:build
```

Outputs land in `src-tauri/target/release/bundle/`:

| OS       | Output path                                                              |
| -------- | ------------------------------------------------------------------------ |
| Windows  | `src-tauri/target/release/bundle/msi/*.msi` and `bundle/nsis/*-setup.exe` |
| Windows  | `src-tauri/target/release/devnotes.exe` (portable binary)                 |
| Linux    | `src-tauri/target/release/bundle/deb/*.deb`                               |
| Linux    | `src-tauri/target/release/bundle/appimage/*.AppImage`                     |
| Linux    | `src-tauri/target/release/bundle/rpm/*.rpm`                               |

### Build a specific target

```bash
# Windows MSI installer only
npm run tauri:build -- --bundles msi

# Windows NSIS installer only
npm run tauri:build -- --bundles nsis

# Linux deb + AppImage
npm run tauri:build -- --bundles deb,appimage
```

### Cross-compile Linux → Windows (from Linux)

You can also build Windows binaries from Linux if you have mingw:

```bash
rustup target add x86_64-pc-windows-gnu
sudo apt install -y mingw-w64
npm run tauri:build -- --target x86_64-pc-windows-gnu --bundles msi
```

### Cross-compile Windows → Linux (from Windows)

Use WSL. Inside WSL:
```bash
cd /mnt/d/projects\ code/minimax\ test/devnotes
npm install
npm run tauri:build -- --bundles deb,appimage
```

---

## Data location

DevNotes stores its SQLite DB in the platform-standard app data directory:

| OS       | Path                                                                |
| -------- | ------------------------------------------------------------------- |
| Linux    | `~/.local/share/com.devnotes.app/devnotes.db`                       |
| Windows  | `%APPDATA%\com.devnotes.app\devnotes.db`                            |

To back up: copy that file, or use **Settings → Export all (JSON)** inside the app.

---

## Stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Shell        | Tauri 2 (Rust)                                    |
| Frontend     | React 18 + TypeScript + Vite                      |
| Styling      | TailwindCSS                                       |
| State (UI)   | Zustand                                           |
| Database     | SQLite via `sqlx`                                 |
| Markdown     | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| Plugins      | sql, store, dialog, fs, notification, global-shortcut |

---

## Keyboard shortcuts

| Action                       | Shortcut                    |
| ---------------------------- | --------------------------- |
| Command palette              | `Ctrl/Cmd + K`              |
| Quick capture (in app)       | `Ctrl/Cmd + Shift + A`      |
| Quick capture (global)       | `Ctrl/Cmd + Shift + Space`  |
| Focus search                 | `Ctrl/Cmd + /`              |

---

## Troubleshooting

### `error: linker not found` on Windows
Install Visual Studio Build Tools with the C++ workload.

### `error: failed to run custom build command for libsqlite3-sys`
On Linux: `sudo apt install libsqlite3-dev`. On macOS: `xcode-select --install`.

### `WebView2` not found on Windows
Install from https://developer.microsoft.com/microsoft-edge/webview2/

### Frontend shows blank window
Open DevTools (right-click → Inspect) and check the Console. Most likely a missing dependency — run `npm install` again.

### Port 1420 already in use
Vite uses port 1420. Either kill the process using it or change it in `vite.config.ts`.

### "Module not found: @tauri-apps/..."
Re-run `npm install` to ensure all Tauri JS packages are pulled in.

---

## License

MIT.
