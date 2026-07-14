// Shared DB helpers — simple, robust wrappers around sqlx::query.
use crate::models::*;
use crate::{AppError, AppResult};
use chrono::Utc;
use sqlx::{Row, SqlitePool};
use sqlx::sqlite::SqliteRow;
use std::collections::HashMap;
use uuid::Uuid;

pub fn now() -> String {
    Utc::now().to_rfc3339()
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn dump_tags(t: &[String]) -> String {
    serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string())
}

pub fn parse_tags(s: &str) -> AppResult<Vec<String>> {
    serde_json::from_str::<Vec<String>>(s).map_err(AppError::from)
}

// Convert a row into a HashMap of column -> JSON value, useful for serialization.
pub fn row_to_map(row: &SqliteRow) -> HashMap<String, serde_json::Value> {
    let mut map = HashMap::new();
    use sqlx::Column;
    use sqlx::TypeInfo;
    for col in row.columns() {
        let name = col.name();
        let ty = col.type_info().name();
        let val = match ty {
            "TEXT" | "VARCHAR" | "NVARCHAR" => {
                row.try_get::<Option<String>, _>(name).ok().flatten()
                    .map(serde_json::Value::String)
            }
            "INTEGER" | "INT" | "BIGINT" => {
                row.try_get::<Option<i64>, _>(name).ok().flatten()
                    .map(serde_json::Value::from)
            }
            "REAL" | "DOUBLE" | "FLOAT" => {
                row.try_get::<Option<f64>, _>(name).ok().flatten()
                    .map(serde_json::Value::from)
            }
            "BLOB" => row.try_get::<Option<Vec<u8>>, _>(name).ok().flatten()
                .map(|b| serde_json::Value::String(format!("<{} bytes>", b.len()))),
            _ => None,
        };
        map.insert(name.to_string(), val.unwrap_or(serde_json::Value::Null));
    }
    map
}

pub fn map_to_skill(map: &HashMap<String, serde_json::Value>) -> AppResult<Skill> {
    let tags_str = map
        .get("tags")
        .and_then(|v| v.as_str())
        .unwrap_or("[]")
        .to_string();
    Ok(Skill {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        name: map.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        category: map.get("category").and_then(|v| v.as_str()).unwrap_or("language").to_string(),
        level: map.get("level").and_then(|v| v.as_i64()).unwrap_or(1),
        description: map.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        color: map.get("color").and_then(|v| v.as_str()).unwrap_or("#22d3ee").to_string(),
        icon: map.get("icon").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        tags: parse_tags(&tags_str)?,
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: map.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        last_reviewed_at: map.get("last_reviewed_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
        ease: map.get("ease").and_then(|v| v.as_f64()).unwrap_or(2.5),
        interval_days: map.get("interval_days").and_then(|v| v.as_i64()).unwrap_or(0),
        repetitions: map.get("repetitions").and_then(|v| v.as_i64()).unwrap_or(0),
        next_review_at: map.get("next_review_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
    })
}

pub fn map_to_note(map: &HashMap<String, serde_json::Value>) -> AppResult<Note> {
    let tags_str = map
        .get("tags")
        .and_then(|v| v.as_str())
        .unwrap_or("[]")
        .to_string();
    Ok(Note {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        title: map.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        content: map.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        tags: parse_tags(&tags_str)?,
        skill_id: map.get("skill_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        is_pinned: map.get("is_pinned").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
        is_archived: map.get("is_archived").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: map.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

pub fn map_to_snippet(map: &HashMap<String, serde_json::Value>) -> AppResult<Snippet> {
    let tags_str = map
        .get("tags")
        .and_then(|v| v.as_str())
        .unwrap_or("[]")
        .to_string();
    Ok(Snippet {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        title: map.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        description: map.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        language: map.get("language").and_then(|v| v.as_str()).unwrap_or("plaintext").to_string(),
        code: map.get("code").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        tags: parse_tags(&tags_str)?,
        skill_id: map.get("skill_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        usage_count: map.get("usage_count").and_then(|v| v.as_i64()).unwrap_or(0),
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: map.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

pub fn map_to_resource(map: &HashMap<String, serde_json::Value>) -> AppResult<Resource> {
    let tags_str = map
        .get("tags")
        .and_then(|v| v.as_str())
        .unwrap_or("[]")
        .to_string();
    Ok(Resource {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        title: map.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        url: map.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        kind: map.get("type").and_then(|v| v.as_str()).unwrap_or("article").to_string(),
        status: map.get("status").and_then(|v| v.as_str()).unwrap_or("to_read").to_string(),
        progress: map.get("progress").and_then(|v| v.as_i64()).unwrap_or(0),
        description: map.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        tags: parse_tags(&tags_str)?,
        skill_id: map.get("skill_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: map.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

pub fn map_to_project(map: &HashMap<String, serde_json::Value>) -> AppResult<Project> {
    let tags_str = map
        .get("tags")
        .and_then(|v| v.as_str())
        .unwrap_or("[]")
        .to_string();
    Ok(Project {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        name: map.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        description: map.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        status: map.get("status").and_then(|v| v.as_str()).unwrap_or("active").to_string(),
        progress: map.get("progress").and_then(|v| v.as_i64()).unwrap_or(0),
        target_date: map.get("target_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
        tags: parse_tags(&tags_str)?,
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: map.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

pub fn map_to_daily(map: &HashMap<String, serde_json::Value>) -> AppResult<DailyEntry> {
    Ok(DailyEntry {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        date: map.get("date").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        kind: map.get("kind").and_then(|v| v.as_str()).unwrap_or("journal").to_string(),
        content: map.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        mood: map.get("mood").and_then(|v| v.as_i64()).unwrap_or(3),
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: map.get("updated_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

pub fn map_to_inbox(map: &HashMap<String, serde_json::Value>) -> AppResult<InboxItem> {
    Ok(InboxItem {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        content: map.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        processed: map.get("processed").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
        created_at: map.get("created_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

pub fn map_to_achievement(map: &HashMap<String, serde_json::Value>) -> AppResult<Achievement> {
    Ok(Achievement {
        id: map.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        code: map.get("code").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        title: map.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        description: map.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        unlocked_at: map.get("unlocked_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
    })
}

// Convenience: run SELECT and map all rows.
pub async fn query_rows(
    db: &SqlitePool,
    sql: &str,
) -> AppResult<Vec<HashMap<String, serde_json::Value>>> {
    let rows: Vec<SqliteRow> = sqlx::query(sql)
        .fetch_all(db)
        .await
        .map_err(AppError::from)?;
    Ok(rows.iter().map(row_to_map).collect())
}

// Convenience: run SELECT WHERE id = ? and map the optional row.
pub async fn query_row_by_id(
    db: &SqlitePool,
    sql: &str,
    id: &str,
) -> AppResult<Option<HashMap<String, serde_json::Value>>> {
    let row: Option<SqliteRow> = sqlx::query(sql)
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(AppError::from)?;
    Ok(row.as_ref().map(row_to_map))
}

// Convenience: count rows.
pub async fn count_rows(db: &SqlitePool, sql: &str) -> AppResult<i64> {
    let row: SqliteRow = sqlx::query(sql)
        .fetch_one(db)
        .await
        .map_err(AppError::from)?;
    Ok(row.try_get::<i64, _>(0).map_err(AppError::from)?)
}
