import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
// https://vitejs.dev/config/
export default defineConfig(function () { return ({
    plugins: [react()],
    resolve: {
        alias: [
            { find: "@", replacement: path.resolve(__dirname, "./src") },
            // lucide-react@1.25.0's main entry drops named re-exports
            // under Rollup tree-shaking, so route the bare specifier
            // to a curated re-export file. Deep imports of
            // `lucide-react/dist/...` inside the wrapper are unaffected.
            {
                find: /^lucide-react$/,
                replacement: path.resolve(__dirname, "./src/lib/icons.tsx"),
            },
        ],
        // Ensure a single, deduped pdfjs-dist is used across react-pdf and our worker
        dedupe: ["pdfjs-dist", "react-pdf"],
    },
    // Prevent Vite from clearing the screen so Tauri logs are visible
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
        // Make sure deps are re-bundled after we changed package.json overrides
        force: true,
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    worker: {
        format: "es",
    },
    optimizeDeps: {
        // Re-bundle these every time `npm install` runs or the lockfile changes
        force: true,
        include: [
            "react-pdf",
            "pdfjs-dist",
            "pdfjs-dist/build/pdf.worker.min.mjs",
            "zustand",
            "@tiptap/extension-bubble-menu",
            "@floating-ui/dom",
        ],
        exclude: ["@tauri-apps/api"],
    },
    build: {
        target: "es2021",
        minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
        rollupOptions: {
        // Some third-party packages ship with `sideEffects: false` and
        // Rollup's tree-shaker drops the named re-exports we depend on,
        // or — worse — emits `const X = X` self-references that crash at
        // runtime with `ReferenceError: Cannot access 'X' before
        // initialization`. Our `resolve.alias` above redirects the
        // affected bare specifiers to local shims that re-export named
        // bindings explicitly, which keeps tree-shaking correct. We just
        // have to make sure first-party code still tree-shakes, so
        // package.json defaults are used.
        },
    },
}); });
