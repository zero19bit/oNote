use crate::commands::helpers::*;
use crate::models::InboxItem;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct InboxInput {
    pub content: String,
}

const INBOX_COLS: &str = "id, content, processed, created_at";

#[tauri::command]
pub async fn list_inbox(db: State<'_, SqlitePool>, only_unprocessed: Option<bool>) -> AppResult<Vec<InboxItem>> {
    let only = only_unprocessed.unwrap_or(true);
    let sql = if only {
        format!("SELECT {} FROM inbox WHERE processed = 0 ORDER BY created_at DESC", INBOX_COLS)
    } else {
        format!("SELECT {} FROM inbox ORDER BY created_at DESC", INBOX_COLS)
    };
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_inbox).collect()
}

#[tauri::command]
pub async fn add_inbox(db: State<'_, SqlitePool>, input: InboxInput) -> AppResult<InboxItem> {
    let id = new_id();
    let ts = now();
    sqlx::query("INSERT INTO inbox (id, content, processed, created_at) VALUES (?1, ?2, 0, ?3)")
        .bind(&id)
        .bind(&input.content)
        .bind(&ts)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(InboxItem {
        id,
        content: input.content,
        processed: false,
        created_at: ts,
    })
}

#[tauri::command]
pub async fn process_inbox(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("UPDATE inbox SET processed = 1 WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_inbox(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM inbox WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}
