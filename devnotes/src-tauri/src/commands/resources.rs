use crate::commands::helpers::*;
use crate::models::Resource;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::SqlitePool;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Deserialize)]
pub struct ResourceInput {
    pub title: String,
    pub url: Option<String>,
    #[serde(alias = "type")]
    pub kind: Option<String>,
    pub source_mode: Option<String>,
    pub local_path: Option<String>,
    pub status: Option<String>,
    pub progress: Option<i64>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub skill_id: Option<String>,
}

const RESOURCE_COLS: &str =
    "id, title, url, \"type\", source_mode, local_path, status, progress, description, tags, skill_id, created_at, updated_at";

fn normalize_kind(kind: Option<String>) -> String {
    kind.unwrap_or_else(|| "website".to_string())
}

fn normalize_source_mode(mode: Option<String>) -> String {
    mode.unwrap_or_else(|| "url".to_string())
}

#[tauri::command]
pub async fn list_resources(db: State<'_, SqlitePool>) -> AppResult<Vec<Resource>> {
    let sql = format!("SELECT {} FROM resources ORDER BY updated_at DESC", RESOURCE_COLS);
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_resource).collect()
}

#[tauri::command]
pub async fn get_resource(db: State<'_, SqlitePool>, id: String) -> AppResult<Resource> {
    let sql = format!("SELECT {} FROM resources WHERE id = ?1", RESOURCE_COLS);
    let row = query_row_by_id(&db, &sql, &id).await?;
    row.map(|m| map_to_resource(&m))
        .transpose()?
        .ok_or_else(|| AppError::from("Resource not found"))
}

#[tauri::command]
pub async fn create_resource(db: State<'_, SqlitePool>, input: ResourceInput) -> AppResult<Resource> {
    let id = new_id();
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let url = input.url.clone().unwrap_or_default();
    let kind = normalize_kind(input.kind.clone());
    let source_mode = normalize_source_mode(input.source_mode.clone());
    let local_path = input.local_path.clone().unwrap_or_default();
    let status = input.status.clone().unwrap_or_else(|| "to_read".to_string());
    let progress = input.progress.unwrap_or(0).clamp(0, 100);
    let description = input.description.clone().unwrap_or_default();

    sqlx::query(
        "INSERT INTO resources (id, title, url, \"type\", source_mode, local_path, status, progress, description, tags, skill_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&url)
    .bind(&kind)
    .bind(&source_mode)
    .bind(&local_path)
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
        source_mode,
        local_path,
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
    let kind = normalize_kind(input.kind.clone());
    let source_mode = normalize_source_mode(input.source_mode.clone());
    let local_path = input.local_path.clone().unwrap_or_default();
    let status = input.status.clone().unwrap_or_else(|| "to_read".to_string());
    let progress = input.progress.unwrap_or(0).clamp(0, 100);
    let description = input.description.clone().unwrap_or_default();

    sqlx::query(
        "UPDATE resources SET title = ?1, url = ?2, \"type\" = ?3, source_mode = ?4, local_path = ?5, status = ?6, progress = ?7, description = ?8, tags = ?9, skill_id = ?10, updated_at = ?11 WHERE id = ?12"
    )
    .bind(&input.title)
    .bind(&url)
    .bind(&kind)
    .bind(&source_mode)
    .bind(&local_path)
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

fn extension_from_path(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| format!(".{}", s))
        .unwrap_or_default()
}

#[tauri::command]
pub async fn stage_resource_file(
    app: AppHandle,
    source_path: String,
    resource_id: String,
) -> AppResult<String> {
    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err(AppError::from("Selected file does not exist"));
    }

    let app_data = app.path().app_data_dir().map_err(|e| AppError::from(e.to_string()))?;
    let library = app_data.join("library");
    fs::create_dir_all(&library).map_err(AppError::from)?;

    let ext = extension_from_path(&source_path);
    let dest = library.join(format!("{}{}", resource_id, ext));
    fs::copy(&source, &dest).map_err(AppError::from)?;

    dest.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::from("Invalid destination path"))
}
