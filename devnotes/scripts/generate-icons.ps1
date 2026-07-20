# Generate platform icons from public/onote-icon.png.
# This is a thin wrapper around scripts/regen_icons.py.
# Run this once on Windows after updating the master icon.

$script = Join-Path $PSScriptRoot "regen_icons.py"

if (-not (Test-Path $script)) {
  Write-Error "Cannot find $script"
  exit 1
}

# Find Python (prefer python, fall back to py launcher)
$python = (Get-Command python -ErrorAction SilentlyContinue) ?? (Get-Command py -ErrorAction SilentlyContinue)
if (-not $python) {
  Write-Error "Python is not on PATH. Install Python 3 and `pip install Pillow`."
  exit 1
}

& $python.Source $script
exit $LASTEXITCODE
