use crate::commands::helpers::*;
use crate::models::Skill;
use crate::{AppError, AppResult};
use chrono::Utc;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct SkillInput {
    pub name: String,
    pub category: Option<String>,
    pub level: Option<i64>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[tauri::command]
pub async fn list_skills(db: State<'_, SqlitePool>) -> AppResult<Vec<Skill>> {
    let rows = query_rows(
        &db,
        "SELECT id, name, category, level, description, color, icon, tags, created_at, updated_at, last_reviewed_at, ease, interval_days, repetitions, next_review_at FROM skills ORDER BY name",
    )
    .await?;
    rows.iter().map(map_to_skill).collect()
}

#[tauri::command]
pub async fn get_skill(db: State<'_, SqlitePool>, id: String) -> AppResult<Option<Skill>> {
    let row = query_row_by_id(
        &db,
        "SELECT id, name, category, level, description, color, icon, tags, created_at, updated_at, last_reviewed_at, ease, interval_days, repetitions, next_review_at FROM skills WHERE id = ?1",
        &id,
    )
    .await?;
    row.as_ref().map(map_to_skill).transpose()
}

#[tauri::command]
pub async fn create_skill(db: State<'_, SqlitePool>, input: SkillInput) -> AppResult<Skill> {
    let id = new_id();
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let category = input.category.clone().unwrap_or_else(|| "language".to_string());
    let level = input.level.unwrap_or(1).clamp(1, 5);
    let color = input.color.clone().unwrap_or_else(|| "#22d3ee".to_string());
    let description = input.description.clone().unwrap_or_default();
    let icon = input.icon.clone().unwrap_or_default();

    sqlx::query(
        "INSERT INTO skills (id, name, category, level, description, color, icon, tags, created_at, updated_at, ease, interval_days, repetitions) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 2.5, 0, 0)"
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&category)
    .bind(level)
    .bind(&description)
    .bind(&color)
    .bind(&icon)
    .bind(&tags_json)
    .bind(&ts)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;

    Ok(Skill {
        id,
        name: input.name,
        category,
        level,
        description,
        color,
        icon,
        tags: parse_tags(&tags_json)?,
        created_at: ts.clone(),
        updated_at: ts,
        last_reviewed_at: None,
        ease: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: None,
    })
}

#[tauri::command]
pub async fn update_skill(
    db: State<'_, SqlitePool>,
    id: String,
    input: SkillInput,
) -> AppResult<()> {
    let ts = now();
    let tags_json = dump_tags(&input.tags.clone().unwrap_or_default());
    let category = input.category.clone().unwrap_or_else(|| "language".to_string());
    let level = input.level.unwrap_or(1).clamp(1, 5);
    let color = input.color.clone().unwrap_or_else(|| "#22d3ee".to_string());
    let description = input.description.clone().unwrap_or_default();
    let icon = input.icon.clone().unwrap_or_default();

    sqlx::query(
        "UPDATE skills SET name = ?1, category = ?2, level = ?3, description = ?4, color = ?5, icon = ?6, tags = ?7, updated_at = ?8 WHERE id = ?9"
    )
    .bind(&input.name)
    .bind(&category)
    .bind(level)
    .bind(&description)
    .bind(&color)
    .bind(&icon)
    .bind(&tags_json)
    .bind(&ts)
    .bind(&id)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_skill(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM skills WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

// SM-2 algorithm — pure function, kept here for clarity.
pub fn sm2_next(ease: f64, interval: i64, reps: i64, quality: i64) -> (f64, i64, i64, String) {
    let q = quality.clamp(0, 5) as f64;
    let mut new_ease = ease + (0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02));
    if new_ease < 1.3 {
        new_ease = 1.3;
    }
    let (new_reps, new_interval) = if q < 3.0 {
        (0, 1)
    } else if reps == 0 {
        (1, 1)
    } else if reps == 1 {
        (2, 6)
    } else {
        (reps + 1, (interval as f64 * new_ease).round() as i64)
    };
    let next = Utc::now() + chrono::Duration::days(new_interval);
    (new_ease, new_interval, new_reps, next.to_rfc3339())
}
