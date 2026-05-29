/**
 * Task & TaskInstance types — shared between the API layer, Mongoose
 * models, and the React pages.
 *
 * Two collections:
 *   - tasks          stores the task rule/template (the "what & when")
 *   - task_instances stores per-day completion records (the "did it happen")
 */

export type TaskScheduleType = "date_specific" | "daily" | "weekly";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "Active" | "Inactive";

export type TaskInstanceStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "cancelled";

export interface AuditUser {
  id: string;
  name: string;
}

/** Weekday integer used in `repeat_days` — Sunday = 0, Saturday = 6. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Task {
  id: string;
  title: string;
  description: string;
  schedule_type: TaskScheduleType;
  /** ISO date — only set when `schedule_type === "date_specific"`. */
  task_date: string | null;
  /** ISO date — required for daily / weekly. */
  start_date: string | null;
  /** ISO date — optional end. `null` = open-ended. */
  end_date: string | null;
  /** Sun-Sat weekday list — only meaningful for weekly. */
  repeat_days: Weekday[];
  /** App user id. */
  assigned_to: string;
  /** Cached display name of the assignee (for table rendering). */
  assigned_to_name?: string;
  priority: TaskPriority;
  /** Free-text category label (e.g. "Work"). Optional. */
  category_id: string;
  /** TaskTag _id, or "" when untagged. */
  tag_id: string;
  /** "HH:mm" 24-hour time, or empty string. */
  reminder_time: string;
  status: TaskStatus;
  created_by: AuditUser;
  updated_by: AuditUser;
  /** ISO timestamp; non-null means soft-deleted. */
  deleted_at: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskInstance {
  id: string;
  task_id: string;
  user_id: string;
  /** ISO date (UTC midnight) — the calendar day this instance is for. */
  task_date: string;
  status: TaskInstanceStatus;
  completed_at: string | null;
  completed_by: AuditUser | null;
  remarks: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Today's-tasks API response shape — task rule + the user's instance for today. */
export interface TodayTask extends Task {
  instance: TaskInstance | null;
  /** True when the instance is from a previous day and still unfinished. */
  is_overdue?: boolean;
  /** Original task_date for overdue instances (ISO date). */
  overdue_date?: string;
}

/** Calendar feed bucket — a date with the tasks scheduled to occur on it. */
export interface CalendarBucket {
  date: string; // YYYY-MM-DD
  tasks: Array<{
    id: string;
    title: string;
    priority: TaskPriority;
    schedule_type: TaskScheduleType;
    /** null means no instance yet — i.e. not acted on. */
    status: TaskInstanceStatus | null;
  }>;
}
