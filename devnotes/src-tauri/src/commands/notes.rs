use crate::commands::helpers::*;
use crate::models::Note;
use crate::{AppError, AppResult};
use serde::Deserialize;
use sqlx::{Row, SqlitePool};
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

#[allow(dead_code)]
const NOTE_COLS: &str =
    "id, title, content, tags, skill_id, project_id, color, is_pinned, is_archived, created_at, updated_at";

/// Build a `Note` from a row + an already-fetched `project_ids` vec.
/// We need this because the JOIN in list/get returns the project_ids
/// in a separate column and we don't want to run a second query per note.
fn row_to_note_with_projects(
    row: &sqlx::sqlite::SqliteRow,
    project_ids: Vec<String>,
) -> AppResult<Note> {
    let map = row_to_map(row);
    // Inject project_ids so map_to_note picks it up.
    let mut m = map;
    m.insert(
        "project_ids".to_string(),
        serde_json::Value::Array(
            project_ids
                .into_iter()
                .map(serde_json::Value::String)
                .collect(),
        ),
    );
    map_to_note(&m)
}

/// SELECT notes.* + group_concat(note_projects.project_id) AS project_ids
/// joined on note_projects.note_id. NULL project_id rows still surface
/// (LEFT JOIN); group_concat returns NULL when no rows match.
#[allow(dead_code)]
const NOTE_SELECT_SQL: &str = "
    SELECT
        n.id, n.title, n.content, n.tags, n.skill_id, n.project_id,
        n.color, n.is_pinned, n.is_archived, n.created_at, n.updated_at,
        (SELECT GROUP_CONCAT(np.project_id, ',')
           FROM note_projects np
          WHERE np.note_id = n.id) AS project_ids_csv
    FROM notes n
";

/// Parse the `project_ids_csv` column from a row into a Vec<String>.
fn parse_project_ids_csv(row: &sqlx::sqlite::SqliteRow) -> Vec<String> {
    let csv: Option<String> = row.try_get("project_ids_csv").ok().flatten();
    csv.map(|s| {
        s.split(',')
            .filter(|p| !p.is_empty())
            .map(|p| p.to_string())
            .collect()
    })
    .unwrap_or_default()
}

#[tauri::command]
pub async fn list_notes(
    db: State<'_, SqlitePool>,
    include_archived: Option<bool>,
) -> AppResult<Vec<Note>> {
    let include = include_archived.unwrap_or(false);
    let where_clause = if include { "" } else { " WHERE n.is_archived = 0 " };
    let sql = format!(
        "{}{} ORDER BY n.updated_at DESC",
        NOTE_SELECT_SQL, where_clause
    );
    let rows = sqlx::query(&sql)
        .fetch_all(&*db)
        .await
        .map_err(AppError::from)?;
    let mut out: Vec<Note> = Vec::with_capacity(rows.len());
    for r in &rows {
        out.push(row_to_note_with_projects(r, parse_project_ids_csv(r))?);
    }
    Ok(out)
}

#[tauri::command]
pub async fn get_note(db: State<'_, SqlitePool>, id: String) -> AppResult<Option<Note>> {
    let sql = format!("{} WHERE n.id = ?1", NOTE_SELECT_SQL);
    let row = sqlx::query(&sql)
        .bind(&id)
        .fetch_optional(&*db)
        .await
        .map_err(AppError::from)?;
    let row = match row {
        Some(r) => r,
        None => return Ok(None),
    };
    Ok(Some(row_to_note_with_projects(&row, parse_project_ids_csv(&row))?))
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
        "INSERT INTO notes (id, title, content, tags, skill_id, project_id, color, is_pinned, is_archived, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL, 'default', ?6, ?7, ?8, ?8)"
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
        project_id: None,
        project_ids: Vec::new(),
        color: "default".to_string(),
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

    // NOTE: project_id is intentionally NOT updated here. Use
    // set_note_projects (preferred, many-to-many) or set_note_project
    // (legacy) so that autosave never wipes project links by accident.
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

/// Legacy single-project setter. Kept for backward compatibility.
/// New code should prefer `set_note_projects` (many-to-many).
#[tauri::command]
pub async fn set_note_project(
    db: State<'_, SqlitePool>,
    id: String,
    project_id: Option<String>,
) -> AppResult<()> {
    let ts = now();
    sqlx::query("UPDATE notes SET project_id = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&project_id)
        .bind(&ts)
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    // Mirror the change in the join table so the two stay in sync.
    // We replace the entire set with either [project_id] or [].
    sqlx::query("DELETE FROM note_projects WHERE note_id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    if let Some(pid) = project_id {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO note_projects (note_id, project_id, created_at) VALUES (?1, ?2, ?3)",
        )
        .bind(&id)
        .bind(&pid)
        .bind(&ts)
        .execute(&*db)
        .await;
    }
    Ok(())
}

/// Set the full set of projects for a note. Pass an empty vec to unlink.
/// Replaces any existing links. Also keeps `notes.project_id` (legacy
/// column) in sync as the first project in the list.
#[tauri::command]
pub async fn set_note_projects(
    db: State<'_, SqlitePool>,
    id: String,
    project_ids: Vec<String>,
) -> AppResult<()> {
    let ts = now();
    let mut tx = db.begin().await.map_err(AppError::from)?;

    sqlx::query("DELETE FROM note_projects WHERE note_id = ?1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

    // Deduplicate while preserving order.
    let mut seen = std::collections::HashSet::new();
    let unique: Vec<String> = project_ids
        .into_iter()
        .filter(|p| seen.insert(p.clone()))
        .collect();

    for pid in &unique {
        sqlx::query(
            "INSERT OR IGNORE INTO note_projects (note_id, project_id, created_at) VALUES (?1, ?2, ?3)",
        )
        .bind(&id)
        .bind(pid)
        .bind(&ts)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;
    }

    let primary = unique.first().cloned();
    sqlx::query("UPDATE notes SET project_id = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&primary)
        .bind(&ts)
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;

    tx.commit().await.map_err(AppError::from)?;
    Ok(())
}

/// Set the color tag for a note. Apple-Notes style.
/// Valid values: "default" | "yellow" | "red" | "green" | "blue" | "purple" | "gray".
/// Unknown values are stored as-is but won't get a special color in the UI.
#[tauri::command]
pub async fn set_note_color(
    db: State<'_, SqlitePool>,
    id: String,
    color: String,
) -> AppResult<()> {
    let ts = now();
    sqlx::query("UPDATE notes SET color = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&color)
        .bind(&ts)
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(AppError::from)?;
    Ok(())
}

/// List all notes linked to a given project (most-recently-updated first).
/// Used by the Projects page.
#[tauri::command]
pub async fn list_project_notes(
    db: State<'_, SqlitePool>,
    project_id: String,
) -> AppResult<Vec<Note>> {
    let sql = format!(
        "{} \
         WHERE n.id IN (SELECT note_id FROM note_projects WHERE project_id = ?1) \
         ORDER BY n.updated_at DESC",
        NOTE_SELECT_SQL
    );
    let rows = sqlx::query(&sql)
        .bind(&project_id)
        .fetch_all(&*db)
        .await
        .map_err(AppError::from)?;
    let mut out: Vec<Note> = Vec::with_capacity(rows.len());
    for r in &rows {
        out.push(row_to_note_with_projects(r, parse_project_ids_csv(r))?);
    }
    Ok(out)
}
