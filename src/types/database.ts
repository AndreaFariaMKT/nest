// Schema types. The source of truth is `database.gen.ts`, produced from the
// live schema by `supabase gen types typescript` (see package.json types:gen).
// This file re-exports it and adds a few app-facing aliases so existing imports
// (MeetingStatus, TaskPriority, …) keep working.

export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./database.gen";

import type { Database } from "./database.gen";

// Enum aliases used across the app.
export type MeetingStatus = Database["public"]["Enums"]["meeting_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type ContentStatus = Database["public"]["Enums"]["content_status"];
export type ContentOrigin = Database["public"]["Enums"]["content_origin"];
export type DesignState = Database["public"]["Enums"]["design_state"];
export type Platform = Database["public"]["Enums"]["platform"];
export type PostType = Database["public"]["Enums"]["post_type"];

// Ordered enum values (for selects, kanban columns, etc.).
export const MEETING_STATUSES: MeetingStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
];
export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
];
export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];
export const POST_TYPES: PostType[] = [
  "carousel",
  "single_image",
  "reel",
  "story",
  "text",
];
export const PLATFORMS: Platform[] = ["instagram", "linkedin", "tiktok"];

// Structured jsonb shapes that the generated types expose only as `Json`.
export type BrandColor = { name: string; hex: string };
export type BrandTypography = { headings: string; body: string };
