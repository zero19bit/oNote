// Centralized wrapper around Tauri invoke with helpful types.
import { invoke } from "@tauri-apps/api/core";

/**
 * Wraps an invoke call so that any error gets logged to the console
 * with full detail — much easier to debug than the toast message.
 */
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e: any) {
    // Log the full error so it shows up in DevTools (F12).
    console.error(`[onote] ${cmd} failed:`, e);
    // Re-throw a clean message for the UI.
    const msg = typeof e === "string" ? e : e?.message ?? String(e);
    throw new Error(msg);
  }
}

export type Category =
  | "language"
  | "framework"
  | "tool"
  | "concept"
  | "domain"
  | "platform";

export interface Skill {
  id: string;
  name: string;
  category: Category | string;
  level: number; // 1..5
  description: string;
  color: string;
  icon: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
  ease: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  skill_id: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Snippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  skill_id: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export type ResourceKind = "article" | "video" | "course" | "book" | "podcast";
export type ResourceStatus = "to_read" | "in_progress" | "done" | "archived";

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: ResourceKind;
  status: ResourceStatus;
  progress: number; // 0..100
  description: string;
  tags: string[];
  skill_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed" | "archived";
  progress: number;
  target_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DailyEntry {
  id: string;
  date: string;
  kind: "journal" | "standup" | "postmortem";
  content: string;
  mood: number;
  created_at: string;
  updated_at: string;
}

export interface InboxItem {
  id: string;
  content: string;
  processed: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  unlocked_at: string;
}

export interface ReviewItem {
  target_type: "skill" | "note" | "snippet";
  target_id: string;
  title: string;
  preview: string;
  skill_id: string | null;
  next_review_at: string | null;
  ease: number;
  interval_days: number;
  repetitions: number;
}

export interface ReviewStats {
  total_skills: number;
  due_today: number;
  reviewed_today: number;
  streak_days: number;
  total_notes: number;
  total_snippets: number;
  total_resources: number;
  total_reviews: number;
  skills_by_level: [number, number][];
  last_7_days_reviews: [string, number][];
}

// Skills
export const listSkills = () => call<Skill[]>("list_skills");
export const getSkill = (id: string) => call<Skill | null>("get_skill", { id });
export const createSkill = (input: Partial<Skill> & { name: string }) =>
  call<Skill>("create_skill", { input });
export const updateSkill = (id: string, input: Partial<Skill> & { name: string }) =>
  call<void>("update_skill", { id, input });
export const deleteSkill = (id: string) => call<void>("delete_skill", { id });

// Notes
export const listNotes = (includeArchived = false) =>
  call<Note[]>("list_notes", { includeArchived });
export const getNote = (id: string) => call<Note | null>("get_note", { id });
export const createNote = (input: Partial<Note> & { title: string }) =>
  call<Note>("create_note", { input });
export const updateNote = (id: string, input: Partial<Note> & { title: string }) =>
  call<void>("update_note", { id, input });
export const deleteNote = (id: string) => call<void>("delete_note", { id });

// Snippets
export const listSnippets = () => call<Snippet[]>("list_snippets");
export const createSnippet = (input: Partial<Snippet> & { title: string; code: string }) =>
  call<Snippet>("create_snippet", { input });
export const updateSnippet = (id: string, input: Partial<Snippet> & { title: string; code: string }) =>
  call<void>("update_snippet", { id, input });
export const deleteSnippet = (id: string) => call<void>("delete_snippet", { id });
export const bumpUsage = (id: string) => call<void>("bump_usage", { id });

// Resources
export const listResources = () => call<Resource[]>("list_resources");
export const createResource = (input: Partial<Resource> & { title: string }) =>
  call<Resource>("create_resource", { input });
export const updateResource = (id: string, input: Partial<Resource> & { title: string }) =>
  call<void>("update_resource", { id, input });
export const deleteResource = (id: string) => call<void>("delete_resource", { id });

// Projects
export const listProjects = () => call<Project[]>("list_projects");
export const createProject = (input: Partial<Project> & { name: string }) =>
  call<Project>("create_project", { input });
export const updateProject = (id: string, input: Partial<Project> & { name: string }) =>
  call<void>("update_project", { id, input });
export const deleteProject = (id: string) => call<void>("delete_project", { id });
export const attachSkill = (projectId: string, skillId: string) =>
  call<void>("attach_skill", { projectId, skillId });
export const detachSkill = (projectId: string, skillId: string) =>
  call<void>("detach_skill", { projectId, skillId });

// Daily
export const listDailyEntries = (limit = 60) =>
  call<DailyEntry[]>("list_daily_entries", { limit });
export const upsertDailyEntry = (input: {
  date: string;
  kind?: "journal" | "standup" | "postmortem";
  content?: string;
  mood?: number;
}) => call<DailyEntry>("upsert_daily_entry", { input });
export const deleteDailyEntry = (id: string) =>
  call<void>("delete_daily_entry", { id });
export const todayDate = () => call<string>("today_date");

// Inbox
export const listInbox = (onlyUnprocessed = true) =>
  call<InboxItem[]>("list_inbox", { onlyUnprocessed });
export const addInbox = (content: string) =>
  call<InboxItem>("add_inbox", { input: { content } });
export const processInbox = (id: string) => call<void>("process_inbox", { id });
export const deleteInbox = (id: string) => call<void>("delete_inbox", { id });

// Review
export const getDueForReview = (limit = 20) =>
  call<ReviewItem[]>("get_due_for_review", { limit });
export const submitReview = (targetType: string, targetId: string, quality: number) =>
  call<void>("submit_review", {
    submission: { target_type: targetType, target_id: targetId, quality },
  });
export const getStats = () => call<ReviewStats>("stats");

// Achievements
export const listAchievements = () => call<Achievement[]>("list_achievements");
export const unlockAchievement = (code: string, title: string, description: string) =>
  call<Achievement>("unlock_achievement", { code, title, description });
