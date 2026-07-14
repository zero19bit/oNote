use crate::commands::helpers::*;
use crate::models::Achievement;
use crate::{AppError, AppResult};
use sqlx::SqlitePool;
use tauri::State;

const ACHIEVEMENT_COLS: &str = "id, code, title, description, unlocked_at";

#[tauri::command]
pub async fn list_achievements(db: State<'_, SqlitePool>) -> AppResult<Vec<Achievement>> {
    let sql = format!("SELECT {} FROM achievements ORDER BY unlocked_at DESC", ACHIEVEMENT_COLS);
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_achievement).collect()
}

#[tauri::command]
pub async fn unlock_achievement(db: State<'_, SqlitePool>, code: String, title: String, description: String) -> AppResult<Achievement> {
    let id = new_id();
    let ts = now();
    sqlx::query("INSERT OR IGNORE INTO achievements (id, code, title, description, unlocked_at) VALUES (?1, ?2, ?3, ?4, ?5)")
        .bind(&id)
        .bind(&code)
        .bind(&title)
        .bind(&description)
        .bind(&ts)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(Achievement {
        id,
        code,
        title,
        description,
        unlocked_at: ts,
    })
}
