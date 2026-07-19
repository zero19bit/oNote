use crate::commands::helpers::*;
use crate::commands::skills::sm2_next;
use crate::models::ReviewStats;
use crate::{AppError, AppResult};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
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

// ─────────────────────────────────────────────────────────────────────────────
// Skill-linked review picker
//
// Used by the new manual review flow: pick a skill, see every note / resource
// linked to it (with last-review date + total review count), select which
// ones to walk through, then go through them one at a time with a
// "Review Complete" button. The old SM-2 spaced-repetition queue above is
// untouched — this is a separate, simpler flow.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct LinkedItem {
    /// "note" or "resource" — used to render the right icon / preview.
    pub kind: String,
    pub id: String,
    pub title: String,
    /// Short preview for cards. For notes: first 200 chars of content. For
    /// resources: the URL or a hint about the file.
    pub preview: String,
    /// For resources: the URL or local path. For notes: empty.
    pub href: String,
    /// For resources: type ("video", "book", ...). For notes: empty.
    pub sub_kind: String,
    /// "to_read" / "in_progress" / "done" / "archived" for resources. Empty
    /// for notes.
    pub status: String,
    /// For notes: tags. For resources: tags. Always parsed from the JSON
    /// column in each table.
    pub tags: Vec<String>,
    /// ISO timestamp of the most recent review_log entry for this item,
    /// or None if it has never been reviewed.
    pub last_reviewed_at: Option<String>,
    /// Total number of review_log entries for this item. 0 = never reviewed.
    pub review_count: i64,
}

#[derive(Debug, Serialize)]
pub struct LinkedItemsResponse {
    pub notes: Vec<LinkedItem>,
    pub resources: Vec<LinkedItem>,
}

/// Return all notes + resources linked to `skill_id`, annotated with their
/// last review date and total review count (from `review_log`).
///
/// Notes/resources that have been archived or soft-deleted are still
/// returned — the user can decide whether they want to review them.
#[tauri::command]
pub async fn get_skill_linked_items(
    db: State<'_, SqlitePool>,
    skill_id: String,
) -> AppResult<LinkedItemsResponse> {
    // NOTES
    let note_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
        "SELECT n.id, n.title, n.content, n.tags, n.is_archived,
                (SELECT MAX(rl.reviewed_at) FROM review_log rl
                   WHERE rl.target_type = 'note' AND rl.target_id = n.id) AS last_reviewed_at,
                (SELECT COUNT(*) FROM review_log rl
                   WHERE rl.target_type = 'note' AND rl.target_id = n.id) AS review_count
           FROM notes n
          WHERE n.skill_id = ?1
          ORDER BY n.is_archived ASC, n.updated_at DESC",
    )
    .bind(&skill_id)
    .fetch_all(&*db)
    .await
    .map_err(AppError::from)?;

    let mut notes: Vec<LinkedItem> = Vec::with_capacity(note_rows.len());
    for row in &note_rows {
        let tags_json: String = row.get("tags");
        let tags_vec: Vec<String> = parse_tags(&tags_json).unwrap_or_default();
        let preview: String = row
            .get::<String, _>("content")
            .chars()
            .take(200)
            .collect::<String>()
            .replace('\n', " ");
        let is_archived: i64 = row.get("is_archived");
        let title: String = row.get("title");
        let final_title = if is_archived != 0 {
            format!("📦 {}", title)
        } else {
            title
        };
        notes.push(LinkedItem {
            kind: "note".to_string(),
            id: row.get("id"),
            title: final_title,
            preview,
            href: String::new(),
            sub_kind: String::new(),
            status: String::new(),
            tags: tags_vec,
            last_reviewed_at: row.try_get("last_reviewed_at").ok().flatten(),
            review_count: row.try_get("review_count").unwrap_or(0i64),
        });
    }

    // RESOURCES
    let resource_rows: Vec<sqlx::sqlite::SqliteRow> = sqlx::query(
        "SELECT r.id, r.title, r.url, r.\"type\", r.source_mode, r.local_path, r.status, r.tags,
                (SELECT MAX(rl.reviewed_at) FROM review_log rl
                   WHERE rl.target_type = 'resource' AND rl.target_id = r.id) AS last_reviewed_at,
                (SELECT COUNT(*) FROM review_log rl
                   WHERE rl.target_type = 'resource' AND rl.target_id = r.id) AS review_count
           FROM resources r
          WHERE r.skill_id = ?1
          ORDER BY r.updated_at DESC",
    )
    .bind(&skill_id)
    .fetch_all(&*db)
    .await
    .map_err(AppError::from)?;

    let mut resources: Vec<LinkedItem> = Vec::with_capacity(resource_rows.len());
    for row in &resource_rows {
        let tags_json: String = row.get("tags");
        let tags_vec: Vec<String> = parse_tags(&tags_json).unwrap_or_default();
        let kind_str: String = row.get("type");
        let source_mode: String = row.get("source_mode");
        let local_path: String = row.get("local_path");
        let url: String = row.get("url");
        let status: String = row.get("status");

        // Build a useful preview/href. For local resources show the file
        // path; for URL-based resources show the URL.
        let (preview, href) = if source_mode == "local" && !local_path.is_empty() {
            // Just the file name, not the whole path
            let file_name = std::path::Path::new(&local_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or(&local_path)
                .to_string();
            (file_name.clone(), local_path.clone())
        } else {
            (url.clone(), url.clone())
        };

        resources.push(LinkedItem {
            kind: "resource".to_string(),
            id: row.get("id"),
            title: row.get("title"),
            preview,
            href,
            sub_kind: kind_str,
            status,
            tags: tags_vec,
            last_reviewed_at: row.try_get("last_reviewed_at").ok().flatten(),
            review_count: row.try_get("review_count").unwrap_or(0i64),
        });
    }

    Ok(LinkedItemsResponse { notes, resources })
}
