use crate::commands::helpers::*;
use crate::models::DailyEntry;
use crate::{AppError, AppResult};
use chrono::Utc;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct DailyInput {
    pub date: String,
    pub kind: Option<String>,
    pub content: Option<String>,
    pub mood: Option<i64>,
}

const DAILY_COLS: &str = "id, date, kind, content, mood, created_at, updated_at";

#[tauri::command]
pub async fn list_daily_entries(db: State<'_, SqlitePool>, limit: Option<i64>) -> AppResult<Vec<DailyEntry>> {
    let lim = limit.unwrap_or(60);
    let sql = format!("SELECT {} FROM daily_entries ORDER BY date DESC LIMIT ?1", DAILY_COLS);
    let rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(&sql)
        .bind(lim)
        .fetch_all(&*db)
        .await
        .map_err(AppError::from)?;
    let mut entries = Vec::new();
    for row in &rows {
        use sqlx::Row;
        let map = std::collections::HashMap::from([
            ("id".to_string(), serde_json::Value::String(row.get::<String, _>("id"))),
            ("date".to_string(), serde_json::Value::String(row.get::<String, _>("date"))),
            ("kind".to_string(), serde_json::Value::String(row.get::<String, _>("kind"))),
            ("content".to_string(), serde_json::Value::String(row.get::<String, _>("content"))),
            ("mood".to_string(), serde_json::Value::from(row.get::<i64, _>("mood"))),
            ("created_at".to_string(), serde_json::Value::String(row.get::<String, _>("created_at"))),
            ("updated_at".to_string(), serde_json::Value::String(row.get::<String, _>("updated_at"))),
        ]);
        entries.push(map_to_daily(&map)?);
    }
    Ok(entries)
}

#[tauri::command]
pub async fn upsert_daily_entry(db: State<'_, SqlitePool>, input: DailyInput) -> AppResult<DailyEntry> {
    let ts = now();
    let kind = input.kind.clone().unwrap_or_else(|| "journal".to_string());
    let content = input.content.clone().unwrap_or_default();
    let mood = input.mood.unwrap_or(3).clamp(1, 5);

    let existing: Option<String> = sqlx::query_scalar("SELECT id FROM daily_entries WHERE date = ?1")
        .bind(&input.date)
        .fetch_optional(&*db)
        .await
        .map_err(AppError::from)?;

    if let Some(id) = existing {
        sqlx::query(
            "UPDATE daily_entries SET kind = ?1, content = ?2, mood = ?3, updated_at = ?4 WHERE id = ?5"
        )
        .bind(&kind)
        .bind(&content)
        .bind(mood)
        .bind(&ts)
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;

        Ok(DailyEntry {
            id,
            date: input.date,
            kind,
            content,
            mood,
            created_at: ts.clone(),
            updated_at: ts,
        })
    } else {
        let id = new_id();
        sqlx::query(
            "INSERT INTO daily_entries (id, date, kind, content, mood, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)"
        )
        .bind(&id)
        .bind(&input.date)
        .bind(&kind)
        .bind(&content)
        .bind(mood)
        .bind(&ts)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;

        Ok(DailyEntry {
            id,
            date: input.date,
            kind,
            content,
            mood,
            created_at: ts.clone(),
            updated_at: ts,
        })
    }
}

#[tauri::command]
pub async fn delete_daily_entry(db: State<'_, SqlitePool>, id: String) -> AppResult<()> {
    sqlx::query("DELETE FROM daily_entries WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

#[tauri::command]
pub async fn today_date() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}
