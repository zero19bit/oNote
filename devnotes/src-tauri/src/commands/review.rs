use crate::commands::helpers::*;
use crate::commands::skills::sm2_next;
use crate::models::ReviewStats;
use crate::{AppError, AppResult};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ReviewItem {
    pub target_type: String,
    pub target_id: String,
    pub title: String,
    pub preview: String,
    pub skill_id: Option<String>,
    pub next_review_at: Option<String>,
    pub ease: f64,
    pub interval_days: i64,
    pub repetitions: i64,
}

#[derive(Debug, Deserialize)]
pub struct ReviewSubmission {
    pub target_type: String,
    pub target_id: String,
    pub quality: i64,
}

#[tauri::command]
pub async fn get_due_for_review(db: State<'_, SqlitePool>, limit: Option<i64>) -> AppResult<Vec<ReviewItem>> {
    let lim = limit.unwrap_or(20);
    let now_ts = now();
    let mut items: Vec<ReviewItem> = Vec::new();

    // Skills that are due
    let skill_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
        "SELECT id, name, description, next_review_at, ease, interval_days, repetitions FROM skills WHERE next_review_at IS NULL OR next_review_at <= ?1 ORDER BY next_review_at ASC LIMIT ?2"
    )
    .bind(&now_ts)
    .bind(lim)
    .fetch_all(&*db)
    .await
    .map_err(AppError::from)?;

    for row in &skill_rows {
        use sqlx::Row;
        items.push(ReviewItem {
            target_type: "skill".to_string(),
            target_id: row.get::<String, _>("id"),
            title: row.get::<String, _>("name"),
            preview: row.get::<String, _>("description"),
            skill_id: Some(row.get::<String, _>("id")),
            next_review_at: row.try_get::<Option<String>, _>("next_review_at").ok().flatten(),
            ease: row.get::<f64, _>("ease"),
            interval_days: row.get::<i64, _>("interval_days"),
            repetitions: row.get::<i64, _>("repetitions"),
        });
    }

    // Notes not reviewed in 14 days
    let note_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
        "SELECT id, title, substr(content, 1, 240) as preview, updated_at FROM notes WHERE is_archived = 0 AND julianday('now') - julianday(updated_at) > 14 ORDER BY updated_at ASC LIMIT ?1"
    )
    .bind(lim)
    .fetch_all(&*db)
    .await
    .map_err(AppError::from)?;

    for row in &note_rows {
        use sqlx::Row;
        items.push(ReviewItem {
            target_type: "note".to_string(),
            target_id: row.get::<String, _>("id"),
            title: row.get::<String, _>("title"),
            preview: row.get::<String, _>("preview"),
            skill_id: None,
            next_review_at: Some(row.get::<String, _>("updated_at")),
            ease: 2.5,
            interval_days: 0,
            repetitions: 0,
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn submit_review(db: State<'_, SqlitePool>, submission: ReviewSubmission) -> AppResult<()> {
    let ts = now();

    // Always log it
    sqlx::query(
        "INSERT INTO review_log (id, target_type, target_id, quality, reviewed_at) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
    .bind(new_id())
    .bind(&submission.target_type)
    .bind(&submission.target_id)
    .bind(submission.quality)
    .bind(&ts)
    .execute(&*db)
    .await
    .map_err(AppError::from)?;

    if submission.target_type == "skill" {
        let row: Option<sqlx::sqlite::SqliteRow> = sqlx::query("SELECT ease, interval_days, repetitions FROM skills WHERE id = ?1")
            .bind(&submission.target_id)
            .fetch_optional(&*db)
            .await
            .map_err(AppError::from)?;

        if let Some(row) = row {
            use sqlx::Row;
            let ease = row.get::<f64, _>("ease");
            let interval = row.get::<i64, _>("interval_days");
            let reps = row.get::<i64, _>("repetitions");
            let (new_ease, new_interval, new_reps, next_at) =
                sm2_next(ease, interval, reps, submission.quality);

            sqlx::query(
                "UPDATE skills SET ease = ?1, interval_days = ?2, repetitions = ?3, next_review_at = ?4, last_reviewed_at = ?5, updated_at = ?5 WHERE id = ?6"
            )
            .bind(new_ease)
            .bind(new_interval)
            .bind(new_reps)
            .bind(&next_at)
            .bind(&ts)
            .bind(&submission.target_id)
            .execute(&*db)
            .await
            .map_err(AppError::from)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn stats(db: State<'_, SqlitePool>) -> AppResult<ReviewStats> {
    let total_skills = count_rows(&db, "SELECT COUNT(*) FROM skills").await?;
    let now_ts = now();
    let due_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM skills WHERE next_review_at IS NULL OR next_review_at <= ?1"
    )
    .bind(&now_ts)
    .fetch_one(&*db)
    .await
    .map_err(AppError::from)?;
    let reviewed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM review_log WHERE date(reviewed_at) = date('now')"
    )
    .fetch_one(&*db)
    .await
    .map_err(AppError::from)?;
    let total_notes: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notes WHERE is_archived = 0")
        .fetch_one(&*db)
        .await
        .map_err(AppError::from)?;
    let total_snippets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM snippets")
        .fetch_one(&*db)
        .await
        .map_err(AppError::from)?;
    let total_resources: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM resources")
        .fetch_one(&*db)
        .await
        .map_err(AppError::from)?;
    let total_reviews: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM review_log")
        .fetch_one(&*db)
        .await
        .map_err(AppError::from)?;

    // Skills grouped by level
    let level_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query("SELECT level, COUNT(*) as cnt FROM skills GROUP BY level ORDER BY level")
        .fetch_all(&*db)
        .await
        .map_err(AppError::from)?;
    let mut skills_by_level: Vec<(i64, i64)> = Vec::new();
    for row in &level_rows {
        use sqlx::Row;
        skills_by_level.push((row.get::<i64, _>("level"), row.get::<i64, _>("cnt")));
    }

    // Last 7 days
    let mut last_7: Vec<(String, i64)> = Vec::new();
    for offset in (0..7).rev() {
        let date = (Utc::now() - Duration::days(offset)).format("%Y-%m-%d").to_string();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM review_log WHERE date(reviewed_at) = ?1")
            .bind(&date)
            .fetch_one(&*db)
            .await
            .map_err(AppError::from)?;
        last_7.push((date, count));
    }

    // Streak
    let mut streak: i64 = 0;
    for offset in 0..365 {
        let date = (Utc::now() - Duration::days(offset)).format("%Y-%m-%d").to_string();
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM review_log WHERE date(reviewed_at) = ?1")
            .bind(&date)
            .fetch_one(&*db)
            .await
            .map_err(AppError::from)?;
        if count > 0 {
            streak += 1;
        } else if offset == 0 {
            continue;
        } else {
            break;
        }
    }

    Ok(ReviewStats {
        total_skills,
        due_today,
        reviewed_today,
        streak_days: streak,
        total_notes,
        total_snippets,
        total_resources,
        total_reviews,
        skills_by_level,
        last_7_days_reviews: last_7,
    })
}
