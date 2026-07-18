// Lightweight Zustand-style store factory that we control
// end-to-end. We don't `import` from the `zustand` package because
// its main entry uses `export * from "zustand/react"` with
// `sideEffects: false`, which Rollup drops during tree-shaking.
// The semantics are 100% compatible with the parts of the Zustand
// API that this codebase actually uses: `create<T>((set, get) => …)`
// returns a `useBoundStore<StoreApi<T>>` that exposes the same
// hook + state-utility surface.

import { useSyncExternalStore } from "react";

type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: false
) => void;
type GetState<T> = () => T;
type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: (state: T, prev: T) => void) => () => void;
  getInitialState: () => T;
  destroy: () => void;
};

type StateCreator<T> = (set: SetState<T>, get: GetState<T>, store: StoreApi<T>) => T;

export type UseBoundStore<T> = {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: StoreApi<T>["subscribe"];
  destroy: StoreApi<T>["destroy"];
};

function createStore<T>(initializer: StateCreator<T>): StoreApi<T> {
  let state: T;
  const listeners = new Set<(s: T, p: T) => void>();

  const setState: SetState<T> = (partial) => {
    const prev = state;
    const next =
      typeof partial === "function"
        ? (partial as (s: T) => T | Partial<T>)(prev)
        : partial;
    state = { ...(prev as object), ...(next as object) } as T;
    listeners.forEach((l) => l(state, prev));
  };

  const getState: GetState<T> = () => state;
  const subscribe: StoreApi<T>["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destroy: StoreApi<T>["destroy"] = () => listeners.clear();

  const store: StoreApi<T> = { getState, setState, subscribe, getInitialState: getState, destroy };

  state = initializer(setState, getState, store);
  return store;
}

/** Create a store hook. `create<T>(initializer)` returns a hook. */
export function create<T>(): (initializer: StateCreator<T>) => UseBoundStore<T>;
export function create<T>(initializer: StateCreator<T>): UseBoundStore<T>;
export function create<T>(initializer?: StateCreator<T>) {
  // Overload: create()() — curried form
  if (initializer === undefined) {
    return (inner: StateCreator<T>) => bind(createStore(inner));
  }
  // Direct form: create(initializer)
  return bind(createStore(initializer));
}

function bind<T>(store: StoreApi<T>): UseBoundStore<T> {
  const useStore: UseBoundStore<T> = <U>(selector?: (state: T) => U) => {
    const read = selector ?? ((s: T) => s as unknown as U);
    return useSyncExternalStore(
      store.subscribe,
      () => read(store.getState()),
      () => read(store.getInitialState())
    );
  };
  useStore.getState = store.getState;
  useStore.setState = store.setState;
  useStore.subscribe = store.subscribe;
  useStore.destroy = store.destroy;
  return useStore;
}
