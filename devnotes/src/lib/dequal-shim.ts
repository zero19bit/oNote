// Re-export of dequal with explicit named bindings so Rollup's
// tree-shaker doesn't drop them.

import { dequal as _dequal } from "dequal";

export const dequal = _dequal;
