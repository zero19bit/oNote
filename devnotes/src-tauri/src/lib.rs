// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::fs;
use tauri::{Manager, Emitter};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

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
                    "type" TEXT NOT NULL DEFAULT 'article', -- article, video, course, book, podcast
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

/// SQL migrations applied on first launch.
/// The schema is intentionally relational so we can join and graph.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: INITIAL_SCHEMA_SQL,
            kind: MigrationKind::Up,
        },
    ]
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
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::Space) {
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
                Ok::<_, AppError>(pool)
            })?;
            app.manage(pool);

            // Register the global shortcut for quick-capture
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::Space,
            );
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
            // snippets
            commands::snippets::list_snippets,
            commands::snippets::create_snippet,
            commands::snippets::update_snippet,
            commands::snippets::delete_snippet,
            commands::snippets::bump_usage,
            // resources
            commands::resources::list_resources,
            commands::resources::create_resource,
            commands::resources::update_resource,
            commands::resources::delete_resource,
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
            // achievements
            commands::achievements::list_achievements,
            commands::achievements::unlock_achievement,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
