use crate::commands::helpers::*;
use crate::models::Project;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct ProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub progress: Option<i64>,
    pub target_date: Option<String>,
    pub tags: Option<Vec<String>>,
}

const PROJECT_COLS: &str = "id, name, description, status, progress, target_date, tags, created_at, updated_at";

#[tauri::command]
pub async fn list_projects(db: State<'_, SqlitePool>) -> AppResult<Vec<Project>> {
    let sql = format!("SELECT {} FROM projects ORDER BY updated_at DESC", PROJECT_COLS);
    let rows = query_rows(&db, &sql).await?;
    rows.iter().map(map_to_project).collect()
}

#[tauri::command]
pub async fn create_project(db: State<'_, SqlitePool>, input: ProjectInput) -> AppResult<Project> {
    let id = new_id();
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let description = input.description.clone().unwrap_or_default();
    let status = input.status.clone().unwrap_or_else(|| "active".to_string());
    let progress = input.progress.unwrap_or(0).clamp(0, 100);

    sqlx::query(
        "INSERT INTO projects (id, name, description, status, progress, target_date, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)"
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&description)
    .bind(&status)
    .bind(progress)
    .bind(&input.target_date)
    .bind(&tags_json)
    .bind(&ts)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;

    Ok(Project {
        id,
        name: input.name,
        description,
        status,
        progress,
        target_date: input.target_date,
        tags: parse_tags(&tags_json)?,
        created_at: ts.clone(),
        updated_at: ts,
    })
}

#[tauri::command]
pub async fn update_project(db: State<'_, SqlitePool>, id: String, input: ProjectInput) -> AppResult<()> {
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let description = input.description.clone().unwrap_or_default();
    let status = input.status.clone().unwrap_or_else(|| "active".to_string());
    let progress = input.progress.unwrap_or(0).clamp(0, 100);

    sqlx::query(
        "UPDATE projects SET name = ?1, description = ?2, status = ?3, progress = ?4, target_date = ?5, tags = ?6, updated_at = ?7 WHERE id = ?8"
    )
    .bind(&input.name)
    .bind(&description)
    .bind(&status)
    .bind(progress)
    .bind(&input.target_date)
    .bind(&tags_json)
    .bind(&ts)
    .bind(&id)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_project(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM projects WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn attach_skill(db: State<'_, SqlitePool>, project_id: String, skill_id: String) -> AppResult<()> {
    sqlx::query("INSERT OR IGNORE INTO project_skills (project_id, skill_id) VALUES (?1, ?2)")
        .bind(&project_id)
        .bind(&skill_id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn detach_skill(db: State<'_, SqlitePool>, project_id: String, skill_id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM project_skills WHERE project_id = ?1 AND skill_id = ?2")
        .bind(&project_id)
        .bind(&skill_id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}
