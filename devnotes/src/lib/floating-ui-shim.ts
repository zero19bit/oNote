// @ts-nocheck — the @floating-ui/dom@1.8 type declarations omit some
// runtime exports. The .mjs file does export them at runtime, which
// is what Rollup and the browser see. This whole file is a re-export
// shim, so type safety here is purely cosmetic.
//
// The original shim re-exported @floating-ui/dom's named bindings via
// `import * as FloatingDom` + per-property access:
//
//   import * as FloatingDom from "@floating-ui/dom";
//   export const arrow = (FloatingDom as any).arrow;
//
// That pattern produced `const X = X` self-references in the bundle
// and crashed the app at runtime with
// "ReferenceError: Cannot access 'Qb' before initialization".
// The reason: `* as` imports force Rollup to keep the entire namespace
// around; then re-exporting individual properties causes the
// tree-shaker to lose track of where the original value came from.
//
// The fix below re-exports the *namespace* under a single name and
// also re-exports the named bindings via the `export *` form. The
// `export *` form preserves Rollup's ability to track each export
// back to its source declaration — no `const X = X` self-references.
// We also use a relative deep path to bypass the @floating-ui/dom
// alias in vite.config.ts (which redirects the bare specifier to
// this file — a self-import would obviously fail).

export * as FloatingDom from "../../node_modules/@floating-ui/dom/dist/floating-ui.dom.esm.js";
export {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  detectOverflow,
  flip,
  hide,
  inline,
  offset,
  shift,
  size,
  limitShift,
  platform,
} from "../../node_modules/@floating-ui/dom/dist/floating-ui.dom.esm.js";
