// Re-export of linkifyjs with explicit named bindings so Rollup's
// tree-shaker doesn't drop them.

import { tokenize as _tokenize, registerCustomProtocol as _rcp, find as _find, test as _test, reset as _reset } from "linkifyjs";

export const tokenize = _tokenize;
export const registerCustomProtocol = _rcp;
export const find = _find;
export const test = _test;
export const reset = _reset;
