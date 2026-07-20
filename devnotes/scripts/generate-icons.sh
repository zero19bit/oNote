#!/usr/bin/env bash
# Generate platform icons from public/onote-icon.png.
# Thin wrapper around scripts/regen_icons.py.
# Requires Python 3 + Pillow: `pip install Pillow`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/regen_icons.py"

if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PY=python
  else
    echo "Python 3 is not installed. Install it and run: pip install Pillow" >&2
    exit 1
  fi
else
  PY=python3
fi

exec "$PY" "$PY_SCRIPT"
