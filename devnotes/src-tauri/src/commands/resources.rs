use crate::commands::helpers::*;
use crate::models::Resource;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct ResourceInput {
    pub title: String,
    pub url: Option<String>,
    pub kind: Option<String>,
    pub status: Option<String>,
    pub progress: Option<i64>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub skill_id: Option<String>,
}

const RESOURCE_COLS: &str = "id, title, url, \"type\", status, progress, description, tags, skill_id, created_at, updated_at";

#[tauri::command]
pub async fn list_resources(db: State<'_, SqlitePool>) -> AppResult<Vec<Resource>> {
    let sql = format!("SELECT {} FROM resources ORDER BY updated_at DESC", RESOURCE_COLS);
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_resource).collect()
}

#[tauri::command]
pub async fn create_resource(db: State<'_, SqlitePool>, input: ResourceInput) -> AppResult<Resource> {
    let id = new_id();
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let url = input.url.clone().unwrap_or_default();
    let kind = input.kind.clone().unwrap_or_else(|| "article".to_string());
    let status = input.status.clone().unwrap_or_else(|| "to_read".to_string());
    let progress = input.progress.unwrap_or(0).clamp(0, 100);
    let description = input.description.clone().unwrap_or_default();

    sqlx::query(
        "INSERT INTO resources (id, title, url, \"type\", status, progress, description, tags, skill_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&url)
    .bind(&kind)
    .bind(&status)
    .bind(progress)
    .bind(&description)
    .bind(&tags_json)
    .bind(&input.skill_id)
    .bind(&ts)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;

    Ok(Resource {
        id,
        title: input.title,
        url,
        kind,
        status,
        progress,
        description,
        tags: parse_tags(&tags_json)?,
        skill_id: input.skill_id,
        created_at: ts.clone(),
        updated_at: ts,
    })
}

#[tauri::command]
pub async fn update_resource(db: State<'_, SqlitePool>, id: String, input: ResourceInput) -> AppResult<()> {
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let url = input.url.clone().unwrap_or_default();
    let kind = input.kind.clone().unwrap_or_else(|| "article".to_string());
    let status = input.status.clone().unwrap_or_else(|| "to_read".to_string());
    let progress = input.progress.unwrap_or(0).clamp(0, 100);
    let description = input.description.clone().unwrap_or_default();

    sqlx::query(
        "UPDATE resources SET title = ?1, url = ?2, \"type\" = ?3, status = ?4, progress = ?5, description = ?6, tags = ?7, skill_id = ?8, updated_at = ?9 WHERE id = ?10"
    )
    .bind(&input.title)
    .bind(&url)
    .bind(&kind)
    .bind(&status)
    .bind(progress)
    .bind(&description)
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
pub async fn delete_resource(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM resources WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}
