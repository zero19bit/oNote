// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::fs;
use tauri::{Manager, Emitter};
use tauri_plugin_sql::Migration;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::commands::helpers::now;

mod models;
mod commands;

const INITIAL_SCHEMA_SQL: &str = r#"
                -- Skills: programming languages, frameworks, tools, concepts
                CREATE TABLE IF NOT EXISTS skills (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'language', -- language, framework, tool, concept, domain
                    level INTEGER NOT NULL DEFAULT 1,           -- 1..5
                    description TEXT NOT NULL DEFAULT '',
                    color TEXT NOT NULL DEFAULT '#22d3ee',
                    icon TEXT NOT NULL DEFAULT '',
                    tags TEXT NOT NULL DEFAULT '[]',           -- JSON array
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_reviewed_at TEXT,
                    -- SM-2 review state per skill
                    ease REAL NOT NULL DEFAULT 2.5,
                    interval_days INTEGER NOT NULL DEFAULT 0,
                    repetitions INTEGER NOT NULL DEFAULT 0,
                    next_review_at TEXT
                );

                -- Notes: free-form markdown notes
                -- NOTE: project_id is intentionally NOT in this CREATE TABLE.
                -- For existing DBs we add it via migration v5 (ALTER); for fresh DBs
                -- the same migration runs after v1, so the schema is consistent
                -- either way. Keeping it out of the inline schema avoids the
                -- "no such column" error when INITIAL_SCHEMA_SQL re-runs on an
                -- old DB that hasn't been migrated yet.
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    tags TEXT NOT NULL DEFAULT '[]',
                    skill_id TEXT,
                    is_pinned INTEGER NOT NULL DEFAULT 0,
                    is_archived INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE SET NULL
                );

                -- Snippets: reusable code blocks
                CREATE TABLE IF NOT EXISTS snippets (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    language TEXT NOT NULL DEFAULT 'plaintext',
                    code TEXT NOT NULL,
                    tags TEXT NOT NULL DEFAULT '[]',
                    skill_id TEXT,
                    usage_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE SET NULL
                );

                -- Resources: learning material bookmarks
                CREATE TABLE IF NOT EXISTS resources (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL DEFAULT '',
                    "type" TEXT NOT NULL DEFAULT 'website', -- video, course, book, podcast, website
                    source_mode TEXT NOT NULL DEFAULT 'url', -- url, local
                    local_path TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'to_read', -- to_read, in_progress, done, archived
                    progress INTEGER NOT NULL DEFAULT 0, -- 0..100
                    description TEXT NOT NULL DEFAULT '',
                    tags TEXT NOT NULL DEFAULT '[]',
                    skill_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE SET NULL
                );

                -- Projects / learning goals
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, archived
                    progress INTEGER NOT NULL DEFAULT 0,
                    target_date TEXT,
                    tags TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                -- Project <-> Skill relation
                CREATE TABLE IF NOT EXISTS project_skills (
                    project_id TEXT NOT NULL,
                    skill_id TEXT NOT NULL,
                    PRIMARY KEY(project_id, skill_id),
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE CASCADE
                );

                -- Daily entries (journal, standup, postmortem)
                CREATE TABLE IF NOT EXISTS daily_entries (
                    id TEXT PRIMARY KEY,
                    date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
                    kind TEXT NOT NULL DEFAULT 'journal', -- journal, standup, postmortem
                    content TEXT NOT NULL DEFAULT '',
                    mood INTEGER NOT NULL DEFAULT 3, -- 1..5
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                -- Achievements unlocked
                CREATE TABLE IF NOT EXISTS achievements (
                    id TEXT PRIMARY KEY,
                    code TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    unlocked_at TEXT NOT NULL
                );

                -- Review log: every review action (for stats & streak)
                CREATE TABLE IF NOT EXISTS review_log (
                    id TEXT PRIMARY KEY,
                    target_type TEXT NOT NULL, -- skill, note, snippet
                    target_id TEXT NOT NULL,
                    quality INTEGER NOT NULL,  -- 0..5 (SM-2)
                    reviewed_at TEXT NOT NULL
                );

                -- Inbox items (quick capture before classification)
                CREATE TABLE IF NOT EXISTS inbox (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    processed INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                -- Indexes
                CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_notes_skill ON notes(skill_id);
                CREATE INDEX IF NOT EXISTS idx_snippets_skill ON snippets(skill_id);
                CREATE INDEX IF NOT EXISTS idx_skills_next_review ON skills(next_review_at);
                CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
                CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date DESC);
            "#;

// NOTE: tauri-plugin-sql's `add_migrations` only runs when the JS-side
// `load(db_url)` API is called. This app uses its own `SqlitePool` and
// custom invoke() commands, so plugin migrations are effectively dead
// code. Schema changes go through the setup hook's `ensure_*` functions
// (see below) which run on every app start. We keep an empty migrations
// list so the plugin doesn't choke on stale data if someone later calls
// load() from JS.
fn migrations() -> Vec<Migration> {
    Vec::new()
}

async fn ensure_resource_columns(pool: &sqlx::SqlitePool) -> Result<(), AppError> {
    let rows = sqlx::query("SELECT name FROM pragma_table_info('resources') WHERE name IN ('source_mode', 'local_path')")
        .fetch_all(pool)
        .await
        .map_err(AppError::from)?;
    if rows.len() < 2 {
        for stmt in [
            "ALTER TABLE resources ADD COLUMN source_mode TEXT NOT NULL DEFAULT 'url'",
            "ALTER TABLE resources ADD COLUMN local_path TEXT NOT NULL DEFAULT ''",
        ] {
            let _ = sqlx::query(stmt).execute(pool).await;
        }
        let _ = sqlx::query("UPDATE resources SET \"type\" = 'website' WHERE \"type\" = 'article'")
            .execute(pool)
            .await;
    }
    Ok(())
}

/// Add the `project_id` column to `notes` if it doesn't exist, and create
/// the index. Idempotent — safe to call on every app start. This is the
/// real migration path for this project (the tauri-plugin-sql migrations
/// are not run because the app uses its own SqlitePool and doesn't call
/// the plugin's JS-side `load()` API).
///
/// NOTE: the legacy `notes.project_id` column is kept for backward
/// compatibility, but new code should use the `note_projects` join table
/// (many-to-many). The legacy column is auto-backfilled into the join
/// table by `backfill_note_projects_from_legacy` on first run.
async fn ensure_notes_project_column(pool: &sqlx::SqlitePool) -> Result<(), AppError> {
    // 1. Is the column already there?
    let row = sqlx::query("SELECT name FROM pragma_table_info('notes') WHERE name = 'project_id'")
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?;

    if row.is_none() {
        // 2a. Add the column. We attach the FK inline. Some older SQLite
        //     versions don't support REFERENCES in ALTER TABLE — fall back
        //     to a plain column if the FK form fails.
        let with_fk = sqlx::query(
            "ALTER TABLE notes ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
        )
        .execute(pool)
        .await;
        if with_fk.is_err() {
            let _ = sqlx::query("ALTER TABLE notes ADD COLUMN project_id TEXT")
                .execute(pool)
                .await;
        }
    }

    // 3. Make sure the index exists (no-op if it does).
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id)")
        .execute(pool)
        .await;

    Ok(())
}

/// Add the `color` column to `notes` (Apple-Notes-style color tag per note).
/// Default is "default" (no color). Other valid values: "yellow", "red",
/// "green", "blue", "purple", "gray". Idempotent.
async fn ensure_notes_color_column(pool: &sqlx::SqlitePool) -> Result<(), AppError> {
    let row = sqlx::query("SELECT name FROM pragma_table_info('notes') WHERE name = 'color'")
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?;
    if row.is_none() {
        let _ = sqlx::query("ALTER TABLE notes ADD COLUMN color TEXT NOT NULL DEFAULT 'default'")
            .execute(pool)
            .await;
    }
    Ok(())
}

/// Create the `note_projects` join table for the many-to-many relation
/// between notes and projects. Idempotent.
async fn ensure_note_projects_table(pool: &sqlx::SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS note_projects (
            note_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(note_id, project_id),
            FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_note_projects_note ON note_projects(note_id)")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_note_projects_project ON note_projects(project_id)")
        .execute(pool)
        .await;

    Ok(())
}

/// Backfill: copy any existing `notes.project_id` values into the
/// `note_projects` join table. Idempotent — uses INSERT OR IGNORE.
/// Safe to call on every app start.
async fn backfill_note_projects_from_legacy(pool: &sqlx::SqlitePool) -> Result<(), AppError> {
    let ts = now();
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO note_projects (note_id, project_id, created_at)
         SELECT id, project_id, ?1 FROM notes
         WHERE project_id IS NOT NULL AND project_id != ''",
    )
    .bind(&ts)
    .execute(pool)
    .await;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppError {
    pub message: String,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError { message: e.to_string() }
    }
}

impl From<tauri_plugin_sql::Error> for AppError {
    fn from(e: tauri_plugin_sql::Error) -> Self {
        AppError { message: e.to_string() }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError { message: e.to_string() }
    }
}

impl From<String> for AppError {
    fn from(e: String) -> Self {
        AppError { message: e }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError { message: e.to_string() }
    }
}

impl From<&str> for AppError {
    fn from(e: &str) -> Self {
        AppError { message: e.to_string() }
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:onote.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        // Cmd+Shift+Space on macOS, Ctrl+Shift+Space elsewhere.
                        #[cfg(target_os = "macos")]
                        let primary = Modifiers::META;
                        #[cfg(not(target_os = "macos"))]
                        let primary = Modifiers::CONTROL;
                        if shortcut.matches(primary | Modifiers::SHIFT, Code::Space) {
                            // global quick-capture: show + focus main window
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                                let _ = app.emit("quick-capture", ());
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("onote.db");
            let pool = tauri::async_runtime::block_on(async {
                let options = SqliteConnectOptions::new()
                    .filename(db_path)
                    .create_if_missing(true)
                    .foreign_keys(true);
                let pool = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect_with(options)
                    .await
                    .map_err(AppError::from)?;
                sqlx::query(INITIAL_SCHEMA_SQL)
                    .execute(&pool)
                    .await
                    .map_err(AppError::from)?;
                ensure_resource_columns(&pool).await?;
                ensure_notes_project_column(&pool).await?;
                ensure_notes_color_column(&pool).await?;
                ensure_note_projects_table(&pool).await?;
                backfill_note_projects_from_legacy(&pool).await?;
                Ok::<_, AppError>(pool)
            })?;
            app.manage(pool);

            // Register the global shortcut for quick-capture.
            // Cmd+Shift+Space on macOS, Ctrl+Shift+Space on Windows / Linux.
            #[cfg(target_os = "macos")]
            let primary = Modifiers::META;
            #[cfg(not(target_os = "macos"))]
            let primary = Modifiers::CONTROL;
            let shortcut = Shortcut::new(Some(primary | Modifiers::SHIFT), Code::Space);
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("Failed to register global shortcut: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            // skills
            commands::skills::list_skills,
            commands::skills::create_skill,
            commands::skills::update_skill,
            commands::skills::delete_skill,
            commands::skills::get_skill,
            // notes
            commands::notes::list_notes,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::get_note,
            commands::notes::set_note_project,
            commands::notes::set_note_projects,
            commands::notes::set_note_color,
            commands::notes::list_project_notes,
            // snippets
            commands::snippets::list_snippets,
            commands::snippets::create_snippet,
            commands::snippets::update_snippet,
            commands::snippets::delete_snippet,
            commands::snippets::bump_usage,
            // resources
            commands::resources::list_resources,
            commands::resources::get_resource,
            commands::resources::create_resource,
            commands::resources::update_resource,
            commands::resources::delete_resource,
            commands::resources::stage_resource_file,
            // projects
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::attach_skill,
            commands::projects::detach_skill,
            // daily
            commands::daily::list_daily_entries,
            commands::daily::upsert_daily_entry,
            commands::daily::delete_daily_entry,
            commands::daily::today_date,
            // inbox
            commands::inbox::list_inbox,
            commands::inbox::add_inbox,
            commands::inbox::process_inbox,
            commands::inbox::delete_inbox,
            // review
            commands::review::get_due_for_review,
            commands::review::submit_review,
            commands::review::stats,
            commands::review::get_skill_linked_items,
            // achievements
            commands::achievements::list_achievements,
            commands::achievements::unlock_achievement,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
