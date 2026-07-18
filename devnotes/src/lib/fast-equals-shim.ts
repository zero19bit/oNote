// Re-export of fast-equals with explicit named bindings so Rollup's
// tree-shaker doesn't drop them (same pattern as the other shims).

import * as FastEquals from "fast-equals";

export const circularDeepEqual = (FastEquals as any).circularDeepEqual;
export const circularShallowEqual = (FastEquals as any).circularShallowEqual;
export const createCustomEqual = (FastEquals as any).createCustomEqual;
export const deepEqual = (FastEquals as any).deepEqual;
export const sameValueZeroEqual = (FastEquals as any).sameValueZeroEqual;
export const shallowEqual = (FastEquals as any).shallowEqual;
export const strictCircularDeepEqual = (FastEquals as any).strictCircularDeepEqual;
export const strictCircularShallowEqual = (FastEquals as any).strictCircularShallowEqual;
export const strictDeepEqual = (FastEquals as any).strictDeepEqual;
export const strictShallowEqual = (FastEquals as any).strictShallowEqual;
