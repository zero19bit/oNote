use crate::commands::helpers::*;
use crate::models::Note;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct NoteInput {
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub skill_id: Option<String>,
    pub is_pinned: Option<bool>,
    pub is_archived: Option<bool>,
}

const NOTE_COLS: &str = "id, title, content, tags, skill_id, is_pinned, is_archived, created_at, updated_at";

#[tauri::command]
pub async fn list_notes(db: State<'_, SqlitePool>, include_archived: Option<bool>) -> AppResult<Vec<Note>> {
    let include = include_archived.unwrap_or(false);
    let sql = if include {
        format!("SELECT {} FROM notes ORDER BY updated_at DESC", NOTE_COLS)
    } else {
        format!("SELECT {} FROM notes WHERE is_archived = 0 ORDER BY updated_at DESC", NOTE_COLS)
    };
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_note).collect()
}

#[tauri::command]
pub async fn get_note(db: State<'_, SqlitePool>, id: String) -> AppResult<Option<Note>> {
    let sql = format!("SELECT {} FROM notes WHERE id = ?1", NOTE_COLS);
    let row = query_row_by_id(&db, &sql, &id).await?;
    row.as_ref().map(map_to_note).transpose()
}

#[tauri::command]
pub async fn create_note(db: State<'_, SqlitePool>, input: NoteInput) -> AppResult<Note> {
    let id = new_id();
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let content = input.content.clone().unwrap_or_default();
    let is_pinned = input.is_pinned.unwrap_or(false) as i64;
    let is_archived = input.is_archived.unwrap_or(false) as i64;

    sqlx::query(
        "INSERT INTO notes (id, title, content, tags, skill_id, is_pinned, is_archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&content)
    .bind(&tags_json)
    .bind(&input.skill_id)
    .bind(is_pinned)
    .bind(is_archived)
    .bind(&ts)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;

    Ok(Note {
        id,
        title: input.title,
        content,
        tags: parse_tags(&tags_json)?,
        skill_id: input.skill_id,
        is_pinned: is_pinned != 0,
        is_archived: is_archived != 0,
        created_at: ts.clone(),
        updated_at: ts,
    })
}

#[tauri::command]
pub async fn update_note(db: State<'_, SqlitePool>, id: String, input: NoteInput) -> AppResult<()> {
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let content = input.content.clone().unwrap_or_default();
    let is_pinned = input.is_pinned.unwrap_or(false) as i64;
    let is_archived = input.is_archived.unwrap_or(false) as i64;

    sqlx::query(
        "UPDATE notes SET title = ?1, content = ?2, tags = ?3, skill_id = ?4, is_pinned = ?5, is_archived = ?6, updated_at = ?7 WHERE id = ?8"
    )
    .bind(&input.title)
    .bind(&content)
    .bind(&tags_json)
    .bind(&input.skill_id)
    .bind(is_pinned)
    .bind(is_archived)
    .bind(&ts)
    .bind(&id)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_note(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM notes WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}
