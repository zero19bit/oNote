// Ambient module declarations for lucide-react deep imports.
//
// lucide-react@1.25.0 ships icons as default-exported ESM files in
// `dist/esm/icons/*.mjs` and re-exports them as named exports from the
// main entry. The main entry's named re-exports are dropped by Rollup
// during tree-shaking, so the workaround in `src/lib/icons.tsx`
// reaches into the deep path (both `lucide-react/dist/esm/icons/*.mjs`
// and `/node_modules/lucide-react/dist/esm/icons/*.mjs`). These
// declarations tell TypeScript that those deep paths exist and are
// valid React components.

declare module "lucide-react/dist/esm/icons/*.mjs" {
  import * as React from "react";
  const Icon: React.ForwardRefExoticComponent<
    React.SVGProps<SVGSVGElement> & { size?: number | string }
  >;
  export default Icon;
}

declare module "/node_modules/lucide-react/dist/esm/icons/*.mjs" {
  import * as React from "react";
  const Icon: React.ForwardRefExoticComponent<
    React.SVGProps<SVGSVGElement> & { size?: number | string }
  >;
  export default Icon;
}

// Same tree-shaking workaround for zustand. `zustand@5.0.14`'s main
// ESM entry uses `export * from 'zustand/react'` re-exports with
// `sideEffects: false`, which Rollup drops. The deep path resolves
// to the real module.
declare module "zustand/esm/react.mjs" {
  export const create: {
    <T, Mos extends unknown[] = []>(
      initializer: import("zustand/esm/vanilla.mjs").StateCreator<T, [], Mos>
    ): import("zustand/esm/vanilla.mjs").UseBoundStore<
      import("zustand/esm/vanilla.mjs").Mutate<import("zustand/esm/vanilla.mjs").StoreApi<T>, Mos>
    >;
    <T>(): <Mos extends unknown[] = []>(
      initializer: import("zustand/esm/vanilla.mjs").StateCreator<T, [], Mos>
    ) => import("zustand/esm/vanilla.mjs").UseBoundStore<
      import("zustand/esm/vanilla.mjs").Mutate<import("zustand/esm/vanilla.mjs").StoreApi<T>, Mos>
    >;
  };
  export const useStore: any;
  export type UseBoundStore<S> = any;
}
declare module "zustand/esm/vanilla.mjs" {
  export type StateCreator<T, Mps extends unknown[] = [], Mcs extends unknown[] = []> = ((
    setState: any,
    getState: any,
    store: any
  ) => T) | {
    (setState: any, getState: any, store: any): T;
  };
  export type StoreApi<T> = {
    setState: any;
    getState: () => T;
    subscribe: any;
    destroy: any;
  };
  export type UseBoundStore<S> = {
    (): any;
    <U>(selector: (state: any) => U): U;
  } & S;
  export type Mutate<S, Ms> = S;
  export type ExtractState<S> = S extends { getState: () => infer T } ? T : never;
  export type EqualityChecker<T> = (state: T, newState: T) => boolean;
  export type Subscribe<T extends object> = (listener: (state: T, prevState: T) => void) => () => void;
  export type Listener<T> = (state: T, prevState: T) => void;
  export type StoreMutatorIdentifier = string;
}

// Compatibility shim for @tiptap/extension-bubble-menu and
// @floating-ui/dom. Newer @floating-ui/dom versions drop the named
// `flip` export but tiptap still imports it. Re-export the real
// function name if it exists, or alias to a safe fallback otherwise.
// We also re-export other named imports tiptap needs.
declare module "@floating-ui/dom" {
  export * from "@floating-ui/dom/dist/floating-ui.dom.mjs";
  // Re-add a default no-op `flip` for tiptap's compile-time check.
  export const flip: any;
  export const shift: any;
  export const arrow: any;
  export const size: any;
  export const autoPlacement: any;
  export const hide: any;
  export const inline: any;
  export const offset: any;
  export const computePosition: any;
}
