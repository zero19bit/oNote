#!/usr/bin/env bash
# Linux icon generator using ImageMagick or rsvg-convert.
# Usage: ./scripts/generate-icons.sh

set -euo pipefail

OUT="src-tauri/icons"
SVG="src-tauri/icons/icon.svg"

mkdir -p "$OUT"

if command -v rsvg-convert >/dev/null 2>&1; then
  for s in 32 128 256 512; do
    rsvg-convert -w $s -h $s "$SVG" > "$OUT/${s}x${s}.png" 2>/dev/null || true
  done
  rsvg-convert -w 256 -h 256 "$SVG" > "$OUT/128x128@2x.png"
  rsvg-convert -w 512 -h 512 "$SVG" > "$OUT/icon.png"
elif command -v convert >/dev/null 2>&1; then
  for s in 32 128 256 512; do
    convert -background "#0b0f17" -resize ${s}x${s} "$SVG" "$OUT/${s}x${s}.png"
  done
  convert -background "#0b0f17" -resize 256x256 "$SVG" "$OUT/128x128@2x.png"
  convert -background "#0b0f17" -resize 512x512 "$SVG" "$OUT/icon.png"
else
  echo "Please install librsvg2-bin (rsvg-convert) or ImageMagick (convert)" >&2
  exit 1
fi

# .icns placeholder (works for Tauri dev on Linux; use iconutil on macOS for prod)
cp "$OUT/icon.png" "$OUT/icon.icns"

# .ico from 256
if command -v convert >/dev/null 2>&1; then
  convert "$OUT/128x128@2x.png" "$OUT/icon.ico"
fi

echo "Icons generated in $OUT"
