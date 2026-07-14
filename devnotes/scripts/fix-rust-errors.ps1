$files = @(
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\skills.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\notes.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\snippets.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\resources.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\projects.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\daily.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\inbox.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\review.rs",
  "D:\projects code\minimax test\devnotes\src-tauri\src\commands\achievements.rs"
)

foreach ($f in $files) {
  $content = Get-Content $f -Raw -Encoding UTF8

  # 1. Imports
  $content = $content -replace 'use tauri_plugin_sql::SqlitePool;', 'use sqlx::SqlitePool;'
  $content = $content -replace 'use tauri_plugin_sql::sqlx::Row;', 'use sqlx::Row;'

  # 2. Remove the broken type alias entirely
  $content = $content -replace "type Db = State<'_, SqlitePool>;\r?\n", ""

  # 3. Replace `db: Db` parameter with inline `State<'_, SqlitePool>`
  $content = $content -replace '\bdb: Db\b', 'db: State<''_, SqlitePool>'

  # 4. Replace all `tauri_plugin_sql::sqlx::` paths with `sqlx::`
  $content = $content -replace 'tauri_plugin_sql::sqlx::', 'sqlx::'

  Set-Content -Path $f -Value $content -Encoding UTF8 -NoNewline
  Write-Host "Fixed: $($f | Split-Path -Leaf)"
}

# 5. Also fix the unused DateTime import in skills.rs
$skillsPath = "D:\projects code\minimax test\devnotes\src-tauri\src\commands\skills.rs"
$skills = Get-Content $skillsPath -Raw -Encoding UTF8
$skills = $skills -replace 'use chrono::\{DateTime, Utc\};', 'use chrono::Utc;'
Set-Content -Path $skillsPath -Value $skills -Encoding UTF8 -NoNewline
Write-Host "Fixed unused import in skills.rs"

Write-Host "`nDone."
