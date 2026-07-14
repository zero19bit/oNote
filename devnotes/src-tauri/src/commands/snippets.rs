use crate::commands::helpers::*;
use crate::models::Snippet;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct SnippetInput {
    pub title: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub code: String,
    pub tags: Option<Vec<String>>,
    pub skill_id: Option<String>,
}

const SNIPPET_COLS: &str = "id, title, description, language, code, tags, skill_id, usage_count, created_at, updated_at";

#[tauri::command]
pub async fn list_snippets(db: State<'_, SqlitePool>) -> AppResult<Vec<Snippet>> {
    let sql = format!("SELECT {} FROM snippets ORDER BY updated_at DESC", SNIPPET_COLS);
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_snippet).collect()
}

#[tauri::command]
pub async fn create_snippet(db: State<'_, SqlitePool>, input: SnippetInput) -> AppResult<Snippet> {
    let id = new_id();
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let description = input.description.clone().unwrap_or_default();
    let language = input.language.clone().unwrap_or_else(|| "plaintext".to_string());

    sqlx::query(
        "INSERT INTO snippets (id, title, description, language, code, tags, skill_id, usage_count, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?8)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&description)
    .bind(&language)
    .bind(&input.code)
    .bind(&tags_json)
    .bind(&input.skill_id)
    .bind(&ts)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;

    Ok(Snippet {
        id,
        title: input.title,
        description,
        language,
        code: input.code,
        tags: parse_tags(&tags_json)?,
        skill_id: input.skill_id,
        usage_count: 0,
        created_at: ts.clone(),
        updated_at: ts,
    })
}

#[tauri::command]
pub async fn update_snippet(db: State<'_, SqlitePool>, id: String, input: SnippetInput) -> AppResult<()> {
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let description = input.description.clone().unwrap_or_default();
    let language = input.language.clone().unwrap_or_else(|| "plaintext".to_string());

    sqlx::query(
        "UPDATE snippets SET title = ?1, description = ?2, language = ?3, code = ?4, tags = ?5, skill_id = ?6, updated_at = ?7 WHERE id = ?8"
    )
    .bind(&input.title)
    .bind(&description)
    .bind(&language)
    .bind(&input.code)
    .bind(&tags_json)
    .bind(&input.skill_id)
    .bind(&ts)
    .bind(&id)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_snippet(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM snippets WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn bump_usage(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("UPDATE snippets SET usage_count = usage_count + 1 WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}
