import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url as string));

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // lucide-react@1.25.0 ships icons as `export { default as Foo } from '...'`
      // in its main ESM entry. Rollup's tree-shaker drops those re-exports
      // because the package is marked `sideEffects: false`, which breaks
      // production builds for every component that imports named icons.
      // We only alias the bare specifier `lucide-react` (regex `$`) so the
      // wrapper file's own deep imports (e.g. `lucide-react/dist/...`)
      // are unaffected by this rule.
      {
        find: /^lucide-react$/,
        replacement: path.resolve(__dirname, "./src/lib/icons.tsx"),
      },
      // The `zustand` main entry re-exports its public API via
      // `export * from 'zustand/react'` with `sideEffects: false`,
      // which Rollup drops during tree-shaking. The deep ESM file is
      // the real module and survives bundling. We keep the
      // bare-specifier import for the rest of the codebase (only
      // src/store/ui.ts needs it) and route the resolution here.
      {
        find: /^zustand$/,
        replacement: path.resolve(__dirname, "./src/lib/store-shim.ts"),
      },
      // Note: @floating-ui/dom was previously aliased to
      // src/lib/floating-ui-shim.ts. The shim caused
      // `const X = X` self-references in the bundle (TDZ
      // errors at runtime). The real package works fine with
      // Vite's default tree-shaking, so we removed the alias
      // and let bare-specifier imports go to the real package.
      {
        find: /^fast-equals$/,
        replacement: path.resolve(__dirname, "./src/lib/fast-equals-shim.ts"),
      },
      {
        find: /^linkifyjs$/,
        replacement: path.resolve(__dirname, "./src/lib/linkifyjs-shim.ts"),
      },
      {
        find: /^dequal$/,
        replacement: path.resolve(__dirname, "./src/lib/dequal-shim.ts"),
      },
      {
        find: /^pdfjs-dist$/,
        replacement: path.resolve(__dirname, "./src/lib/pdfjs-shim.ts"),
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
  // Make sure the pdf.js worker is treated as a static asset and gets a
  // stable URL in both dev and production builds.
  assetsInclude: ["**/*.mjs"],
  worker: {
    format: "es" as const,
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
    ],
    exclude: ["@tauri-apps/api", "@floating-ui/dom"],
  },
  build: {
    target: "es2021",
    minify: process.env.TAURI_ENV_DEBUG ? false : ("esbuild" as const),
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
}));
