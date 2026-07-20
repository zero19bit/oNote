"""
Regenerate all Tauri icons from public/onote-icon.png (the pen+brackets design).

Source of truth: devnotes/public/onote-icon.png  (a 256x256 PNG of the design)
This script resizes it to every size Tauri + Windows need and packs a
proper multi-size icon.ico (16, 24, 32, 48, 64, 128, 256) so Windows can
pick the right frame for the title bar, taskbar, and Alt-Tab.

Outputs (overwritten in place):
  devnotes/src-tauri/icons/32x32.png
  devnotes/src-tauri/icons/128x128.png
  devnotes/src-tauri/icons/128x128@2x.png       (256x256)
  devnotes/src-tauri/icons/icon.png             (512x512)
  devnotes/src-tauri/icons/icon.ico             (multi-size)
  devnotes/src-tauri/icons/icon.icns            (placeholder; macOS uses iconutil)

Requires: Pillow (pip install Pillow)
"""
import os
import struct
import shutil
from io import BytesIO
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'onote-icon.png')
OUT = os.path.join(ROOT, 'src-tauri', 'icons')

# Standard Tauri + Windows icon sizes
SIZES_PNG = {
    '32x32.png':       32,
    '128x128.png':     128,
    '128x128@2x.png':  256,   # 128@2x retina
    'icon.png':        512,
}
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def main() -> int:
    if not os.path.isfile(SRC):
        print(f'ERROR: source not found: {SRC}', flush=True)
        return 1

    os.makedirs(OUT, exist_ok=True)
    src = Image.open(SRC).convert('RGBA')
    print(f'source: {SRC}  size={src.size}  mode={src.mode}')

    # 1. Write individual PNGs (high-quality LANCZOS downsample)
    for name, size in SIZES_PNG.items():
        path = os.path.join(OUT, name)
        src.resize((size, size), Image.LANCZOS).save(path, 'PNG', optimize=True)
        print(f'  wrote {path}  ({size}x{size})')

    # 2. Build multi-size icon.ico (manual, since Pillow's ICO writer is
    #    known to misbehave with append_images + non-256 sizes).
    blobs = []
    for s in ICO_SIZES:
        buf = BytesIO()
        src.resize((s, s), Image.LANCZOS).save(buf, format='PNG', optimize=True)
        blobs.append((s, s, buf.getvalue()))

    header_size = 6 + 16 * len(blobs)
    ico = bytearray()
    ico += struct.pack('<HHH', 0, 1, len(blobs))   # ICONDIR
    data_offset = header_size
    for (w, h, blob) in blobs:
        # 0 in the ICONDIRENTRY width/height fields means 256
        w_b = 0 if w == 256 else w
        h_b = 0 if h == 256 else h
        ico += struct.pack('<BBBBHHII', w_b, h_b, 0, 0, 1, 32, len(blob), data_offset)
        data_offset += len(blob)
    for (_, _, blob) in blobs:
        ico += blob

    ico_path = os.path.join(OUT, 'icon.ico')
    with open(ico_path, 'wb') as f:
        f.write(ico)
    print(f'  wrote {ico_path}  ({len(ico)} bytes, sizes={ICO_SIZES})')

    # 3. icon.icns: Tauri needs this on macOS. Dev accepts the 512 PNG as
    #    a placeholder; production macOS should regenerate with `iconutil`.
    icns_path = os.path.join(OUT, 'icon.icns')
    shutil.copyfile(os.path.join(OUT, 'icon.png'), icns_path)
    print(f'  wrote {icns_path}  (placeholder; regen on macOS with iconutil)')

    print('\nAll icons regenerated.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
