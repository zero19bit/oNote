// Shared Rust <-> TS data models
// Keep these aligned with the SQL schema in lib.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub category: String,
    pub level: i64,
    pub description: String,
    pub color: String,
    pub icon: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_reviewed_at: Option<String>,
    pub ease: f64,
    pub interval_days: i64,
    pub repetitions: i64,
    pub next_review_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub skill_id: Option<String>,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub description: String,
    pub language: String,
    pub code: String,
    pub tags: Vec<String>,
    pub skill_id: Option<String>,
    pub usage_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub id: String,
    pub title: String,
    pub url: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub status: String,
    pub progress: i64,
    pub description: String,
    pub tags: Vec<String>,
    pub skill_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub progress: i64,
    pub target_date: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyEntry {
    pub id: String,
    pub date: String,
    pub kind: String,
    pub content: String,
    pub mood: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxItem {
    pub id: String,
    pub content: String,
    pub processed: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub code: String,
    pub title: String,
    pub description: String,
    pub unlocked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewStats {
    pub total_skills: i64,
    pub due_today: i64,
    pub reviewed_today: i64,
    pub streak_days: i64,
    pub total_notes: i64,
    pub total_snippets: i64,
    pub total_resources: i64,
    pub total_reviews: i64,
    pub skills_by_level: Vec<(i64, i64)>,
    pub last_7_days_reviews: Vec<(String, i64)>,
}
