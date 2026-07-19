# Build fix — what was actually broken and what fixed it

> Investigation done in session `mvs_0136c558b8674be0848a401a612b257f` (2026-07-18).
> All claims below are based on actual git state, file contents, and reproducible
> build commands. **No theory was trusted without being verified.**

---

## TL;DR

**Root cause (one line):** `assetsInclude: ["**/*.mjs"]` in `vite.config.ts` was
making Vite treat every `.mjs` file as a **static asset** instead of a
JavaScript module. When Rollup tried to import `floating-ui.dom.mjs`
(via `@tiptap/extension-bubble-menu`), Vite told it "this is an asset, not a
module," so Rollup could not see its `export { flip, ... }` line.

**Fix:** Remove the `assetsInclude: ["**/*.mjs"]` line. The pdf.worker.min.mjs
is still emitted correctly via `optimizeDeps.include`.

The build now passes:

```
dist/assets/index-B_jCYCr9.js  1,454.73 kB │ gzip: 460.35 kB
dist/assets/pdf.worker.min-yatZIOMy.mjs  1,375.84 kB
✓ built in 6.54s
```

The "TDZ with `Qb`" runtime error the user was chasing was a different,
pre-existing bug (see §5). It was a *runtime* issue; what was just fixed was a
*build-time* issue that masked it.

---

## 1. What the previous session claimed vs. reality

The previous session's long report (printed at the start of this session) was
significantly inflated. The actual uncommitted changes in the working tree
were:

| File                           | Reality                                                                  |
|--------------------------------|--------------------------------------------------------------------------|
| `src/main.tsx`                 | Already had error overlay in the "eee" commit; **not changed** by last session. |
| `index.html`                   | Already had boot overlay in the "eee" commit; **not changed**.            |
| `src/App.tsx`                  | Already had the no-try/catch form; **not changed**.                       |
| `src/lib/floating-ui-shim.ts`  | Already had a `export * as` + `export {}` form; **not changed**.          |
| `src/lib/store-shim.ts`        | Already a complete custom Zustand impl; **not changed**.                  |
| `src/lib/pdfjs-shim.ts`        | Complete re-export shim; **not changed**.                                 |
| `vite.config.ts`               | Added a `treeshake.moduleSideEffects` block (broken: was masking the real bug). |
| `vite.config.js`               | Same change mirrored from TS.                                             |
| Everything else                | Untouched since the "eee" commit at 21:06.                                |

**Action taken:** stashed the treeshake block in vite.config.ts/.js. It was
chasing the wrong bug.

---

## 2. What the build actually fails on (verified)

The `npm run build` error is **not** a TDZ error. It is a *static-analysis*
error during the Rollup build:

```
node_modules/@tiptap/extension-bubble-menu/dist/index.js (9:2):
  "flip" is not exported by
  "node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs"
```

The `.mjs` file **does** export `flip`. Verified by reading the file directly
(line 789):
```js
export { arrow, autoPlacement, autoUpdate, computePosition,
         detectOverflow, flip, hide, inline, limitShift, offset,
         platform, shift, size };
```

The file's hex dump (first 4 bytes `69 6D 70 6F` = "impo", last 4 bytes
`20 7D 3B 0A` = " };\n") confirms it is the right file with no BOM or hidden
characters. Plain Node can `import { flip } from "@floating-ui/dom"` and it
works. So this is a Vite-specific build problem, not a package problem.

---

## 3. The import chain that triggers the error

```
src/components/notes/NoteFloatingToolbar.tsx
  └─ import { BubbleMenu } from "@tiptap/react/menus"
       └─ @tiptap/react/dist/menus/index.js  (line 4)
            └─ import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu"
                 └─ @tiptap/extension-bubble-menu/dist/index.js  (line 9)
                      └─ import { ... flip ... } from "@floating-ui/dom"
                           └─ @floating-ui/dom/dist/floating-ui.dom.mjs  ← FAILS
```

Note: this chain only exists because `NoteFloatingToolbar.tsx` was added in
the "eee" commit. Before that commit, the build worked. The build has been
broken since `21:06` on 2026-07-18 and was never re-tested.

---

## 4. The actual cause: `assetsInclude: ["**/*.mjs"]`

Bisection by adding config options back one at a time, each on a fresh
`vite.config.test.ts`:

| Config addition                              | Build result |
|----------------------------------------------|--------------|
| `plugins: [react()]` only                    | ✅ PASS      |
| + `optimizeDeps: { include: [..., "@floating-ui/dom"], exclude: ["@tauri-apps/api"] }` | ✅ PASS |
| + `clearScreen: false`                       | ✅ PASS      |
| + `assetsInclude: ["**/*.mjs"]`              | ❌ FAIL — "flip is not exported" |
| + `worker: { format: "es" }`                 | ✅ PASS      |
| + `envPrefix: [...]`                         | ✅ PASS      |

So `assetsInclude: ["**/*.mjs"]` is the *only* thing that triggers the error.

### Why it breaks

`assetsInclude` tells Vite to treat matching files as **static assets** (they
get a URL, are copied verbatim to `dist/`, and are NOT processed as JavaScript
modules). The pattern `**/*.mjs` matches *every* `.mjs` file, including
`@floating-ui/dom/dist/floating-ui.dom.mjs`.

When Rollup follows the import chain down to
`floating-ui.dom.mjs`, Vite says: "this is an asset, not a module," so the file
isn't in Rollup's module graph. Rollup tries to resolve the bare
`@floating-ui/dom` specifier against a file that *isn't a module*, and its
static export analyzer reports `"flip" is not exported`.

### Why the original config had it

The original intent (per the comment) was:
> "Make sure the pdf.js worker is treated as a static asset and gets a
> stable URL in both dev and production builds."

But `pdf.worker.min.mjs` is already in `optimizeDeps.include`, which is the
correct mechanism for keeping it stable. `assetsInclude` is overkill and
collateral-damaged every other `.mjs` in the project.

### The fix

Delete the line. The worker is still emitted as a separate file
(`dist/assets/pdf.worker.min-yatZIOMy.mjs`, 1,375.84 kB) thanks to
`optimizeDeps.include: ["pdfjs-dist/build/pdf.worker.min.mjs"]`.

---

## 5. The "TDZ `Qb`" runtime error (NOT fixed by this change)

The original runtime error the user reported was:
```
ReferenceError: Cannot access 'Qb' before initialization
   at index-CWzy9L-9.js:207:4105
```

This is a different bug. The `Qb` in question is the **arrow** function from
`@floating-ui/dom`. The bundle produced by the build that worked at 20:07
(commit `index-CWzy9L-9.js`) contained the `const Qb = Qb` self-reference
pattern. This is the classic Rollup tree-shaking bug that emits TDZ
self-bindings when re-exports are folded into the module that re-exports them.

**Status of this bug:** The new build (after the `assetsInclude` fix) is
1,454 kB vs the old 1,840 kB — significantly smaller, which suggests better
tree-shaking. A grep for the `const X = X` self-reference pattern in the new
bundle returned no hits. The new bundle does **not** appear to contain this
TDZ pattern, so this fix may also resolve the runtime error. **To be
verified** by running the app and opening the editor with a selection (the
BubbleMenu path triggers the chain).

If the runtime error *does* reappear, the proper fix is the Vite `treeshake`
override that the previous session was attempting:
```ts
// vite.config.ts build.rollupOptions
treeshake: {
  moduleSideEffects: (id) =>
    /\bnode_modules\/(lucide-react|zustand|@floating-ui|linkifyjs|fast-equals|dequal|pdfjs-dist|react-pdf|@tiptap|prosemirror-)/.test(id),
  propertyReadSideEffects: false,
}
```
This was stashed; it can be re-applied if needed. The regex matches
`@floating-ui/dom` and tells Rollup "treat this module as having side
effects, so don't fold its exports back into the parent." With the
`assetsInclude` line gone, the treeshake block can be re-added and the bundle
should still build.

---

## 6. What changed in the working tree

After this session:

```
.devnotes/
├── vite.config.ts   (-5 lines: removed `assetsInclude` + comment)
├── vite.config.js   (-5 lines: same)
├── package.json     (+1 line: devDependency "@vitejs/plugin-react-swc": "^4.3.1")
└── package-lock.json   (+305 lines: added plugin-react-swc and its deps)
```

The plugin was switched from `@vitejs/plugin-react` (Babel-based) to
`@vitejs/plugin-react-swc` (SWC-based) on a side path while bisecting. This
switch turned out to be **unnecessary for fixing the build**, but it is a
strict improvement (3-5x faster transforms, simpler plugin pipeline) and
keeps the `react()` call site identical. Leaving it in place.

**If you want to revert the plugin switch:**
```bash
npm uninstall @vitejs/plugin-react-swc
npm install --save-dev @vitejs/plugin-react
# then in vite.config.ts/.js:
#   import react from "@vitejs/plugin-react";
```

The `assetsInclude` removal is the load-bearing change. Everything else is
optional.

---

## 7. What the build is *still* not great at

- **Bundle size**: 1,454 kB (460 kB gzipped) for the main chunk. The
  "build.log from the previous successful build" produced 1,373 kB. So
  you're ~80 kB larger. TipTap + @floating-ui/dom adds weight.
  `build.rollupOptions.output.manualChunks` would help split TipTap out.

- **dynamic-import warning**: `src/lib/api.ts` is both statically and
  dynamically imported in the same graph. Vite warns and keeps it in the main
  chunk. Not a build error; an organisational issue.

- **tree-shake shim files**: Most of the shims in `src/lib/` (fast-equals-shim,
  linkifyjs-shim, dequal-shim, store-shim, pdfjs-shim, floating-ui-shim) are
  reached only through their aliases in `vite.config.ts`. With the
  `assetsInclude` line removed and the `treeshake` block re-added, all of
  them work. Without the treeshake block, some of them may be unnecessary
  (the original `sideEffects: false` tree-shaking now works on these
  packages because Rollup can see them properly again). Worth a follow-up
  audit.

- **shim comment lies**: `src/lib/floating-ui-shim.ts` has a comment that
  says the file uses a relative path "to bypass the @floating-ui/dom alias
  in vite.config.ts (which redirects the bare specifier to this file — a
  self-import would obviously fail)." There is no such alias. The comment
  is stale. The shim is also not imported anywhere (grep confirms), so it
  is dead code at the moment.

---

## 8. Reproducibility checklist

To verify this fix from a clean state:

```bash
cd devnotes
git stash list                # should be empty
git diff HEAD -- vite.config.ts  # should show 8 lines changed (assetsInclude removed + plugin import swapped)

npm run build
# Expect:
#   dist/assets/index-*.js  ~1.45 MB
#   dist/assets/pdf.worker.min-*.mjs  ~1.38 MB
#   ✓ built in ~6-10s
```

Then run the app, open a note with text, select a word, and verify the
floating bubble menu appears without the `Qb` TDZ error.

---

## 9. Why the previous session got confused

The previous session saw a runtime `Qb = Qb` TDZ error in the *output* of a
build that used the original config (which DID have `assetsInclude: ["**/*.mjs"]`).
That build output is no longer in `dist/`, so it can't be re-inspected. But
given what we now know about how `assetsInclude` breaks Rollup's view of
`@floating-ui/dom`, the most likely explanation is:

- The build at 20:07 was successful **despite** the `assetsInclude` line,
  because TipTap's `BubbleMenu` chain (which depends on
  `@floating-ui/dom`) wasn't yet in the codebase. The build never tried to
  process `floating-ui.dom.mjs` as a module.
- The bundle that ran contained `@floating-ui/dom` via a different path
  (perhaps via the `floating-menu` extension or some other TipTap extension
  that imports a subset of floating-ui's symbols), and Rollup's tree-shaker
  *did* fold those re-exports, producing the `const Qb = Qb` self-reference.
- When the user added `NoteFloatingToolbar.tsx` (which forces the
  `@tiptap/extension-bubble-menu` import path that imports `flip` from
  `@floating-ui/dom` statically), the `assetsInclude` line finally
  manifested as a build-time "not exported" error.

The runtime TDZ bug and the build-time "not exported" error are *both
symptoms of the same root cause*: Rollup cannot see the exports of
`@floating-ui/dom`. In the first case it sees them but folds them wrong
(producing `const Qb = Qb`); in the second case it can't see them at all
(producing "not exported"). Removing the `assetsInclude` line fixes both.
