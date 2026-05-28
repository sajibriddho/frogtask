/**
 * TaskTag — per-user tag/label used to categorise tasks.
 *
 * Lives in the `task_tags` collection. Owned by `user_id` (the creator).
 * Tasks reference a tag via `tag_id`; if the tag is deleted the task is
 * left dangling with an empty tag (handled by the API).
 */

export interface TaskTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export const TASK_TAG_COLORS: string[] = [
  "#059669", // emerald
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#475569", // slate
];
