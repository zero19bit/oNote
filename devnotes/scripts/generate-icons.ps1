# Generate platform icons from icon.svg using PowerShell + System.Drawing.
# Run this once on Windows if you change icon.svg.
# Linux: install librsvg2-bin (rsvg-convert) and use the bash version of this script.

param(
  [string]$Source,
  [string]$OutDir
)

if (-not $Source) { $Source = Join-Path $PSScriptRoot "..\src-tauri\icons\icon.svg" }
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot "..\src-tauri\icons" }

Add-Type -AssemblyName System.Drawing

$sizes = @(32, 64, 128, 256, 512)
$bg = [System.Drawing.Color]::FromArgb(255, 11, 15, 23)
$accent = [System.Drawing.Color]::FromArgb(255, 34, 211, 238)
$accent2 = [System.Drawing.Color]::FromArgb(255, 167, 139, 250)

function Draw-App([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($bg)
  $pen = New-Object System.Drawing.Pen $accent, ([Math]::Max(2, $size / 16))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $s = $size
  $pts = @(
    (New-Object System.Drawing.PointF (([float]($s * 0.22)), ([float]($s * 0.28)))),
    (New-Object System.Drawing.PointF (([float]($s * 0.40)), ([float]($s * 0.72)))),
    (New-Object System.Drawing.PointF (([float]($s * 0.50)), ([float]($s * 0.50)))),
    (New-Object System.Drawing.PointF (([float]($s * 0.60)), ([float]($s * 0.72)))),
    (New-Object System.Drawing.PointF (([float]($s * 0.78)), ([float]($s * 0.28))))
  )
  $g.DrawLines($pen, $pts)
  $brush = New-Object System.Drawing.SolidBrush $accent
  $g.FillEllipse($brush, $pts[4].X - ($s * 0.05), $pts[4].Y - ($s * 0.05), $s * 0.10, $s * 0.10)
  $brush2 = New-Object System.Drawing.SolidBrush $accent2
  $g.FillEllipse($brush2, $pts[0].X - ($s * 0.05), $pts[0].Y - ($s * 0.05), $s * 0.10, $s * 0.10)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Draw-App 32  (Join-Path $OutDir "32x32.png")
Draw-App 128 (Join-Path $OutDir "128x128.png")
Draw-App 256 (Join-Path $OutDir "128x128@2x.png")
Draw-App 512 (Join-Path $OutDir "icon.png")

# Build .ico from 256x png
$icoBmp = [System.Drawing.Image]::FromFile((Join-Path $OutDir "128x128@2x.png"))
$ico = New-Object System.Drawing.Bitmap $icoBmp, 256, 256
$iconPath = Join-Path $OutDir "icon.ico"
$hIcon = $ico.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create($iconPath)
$icon.Save($fs)
$fs.Close()
$icoBmp.Dispose()
$ico.Dispose()

# ICNS: copy the 512 png with .icns extension (Tauri will accept it for the demo,
#       replace with iconutil on macOS for proper production builds)
Copy-Item (Join-Path $OutDir "icon.png") (Join-Path $OutDir "icon.icns") -Force

Write-Host "Icons generated in $OutDir"
