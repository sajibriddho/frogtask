/**
 * task-payload.ts — server-side validation & normalisation for the task
 * create/update payload. Keeps the API routes tidy: each route just calls
 * `validateTaskPayload(body)` and gets back a clean, schedule-correct
 * object (or a 400-shaped error).
 */

import { toUtcMidnight } from "@/lib/task-schedule";
import type {
  TaskPriority,
  TaskScheduleType,
  TaskStatus,
  Weekday,
} from "@/types/task";

const SCHEDULE_TYPES: TaskScheduleType[] = [
  "date_specific",
  "daily",
  "weekly",
];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: TaskStatus[] = ["Active", "Inactive"];

export interface ValidatedTaskPayload {
  title: string;
  description: string;
  schedule_type: TaskScheduleType;
  task_date: Date | null;
  start_date: Date | null;
  end_date: Date | null;
  repeat_days: Weekday[];
  priority: TaskPriority;
  category_id: string;
  tag_id: string;
  reminder_time: string;
  status: TaskStatus;
}

export type ValidationResult =
  | { ok: true; data: ValidatedTaskPayload }
  | { ok: false; error: string };

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function validateTaskPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const b = raw as Record<string, unknown>;

  const title = asString(b.title).trim();
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > 200)
    return { ok: false, error: "Title must be 200 characters or less" };

  const schedule_type = b.schedule_type as TaskScheduleType;
  if (!SCHEDULE_TYPES.includes(schedule_type)) {
    return { ok: false, error: "Invalid schedule type" };
  }

  const priority = (b.priority as TaskPriority) ?? "medium";
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, error: "Invalid priority" };
  }

  const status = (b.status as TaskStatus) ?? "Active";
  if (!STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  let task_date: Date | null = null;
  let start_date: Date | null = null;
  let end_date: Date | null = null;
  let repeat_days: Weekday[] = [];

  if (schedule_type === "date_specific") {
    task_date = toUtcMidnight(b.task_date as string | null | undefined);
    if (!task_date)
      return { ok: false, error: "Task date is required for a date-specific task" };
  } else {
    start_date = toUtcMidnight(b.start_date as string | null | undefined);
    if (!start_date)
      return { ok: false, error: "Start date is required" };

    end_date = toUtcMidnight(b.end_date as string | null | undefined);
    if (end_date && end_date.getTime() < start_date.getTime()) {
      return { ok: false, error: "End date must be on or after start date" };
    }

    if (schedule_type === "weekly") {
      const days = Array.isArray(b.repeat_days) ? b.repeat_days : [];
      const norm = Array.from(
        new Set(
          days
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
        ),
      ).sort((a, b) => a - b) as Weekday[];
      if (norm.length === 0)
        return {
          ok: false,
          error: "Pick at least one weekday for a weekly task",
        };
      repeat_days = norm;
    }
  }

  const reminder_time = asString(b.reminder_time).trim();
  // Optional. Loose match — accepts "HH:mm" or "H:mm".
  if (reminder_time && !/^\d{1,2}:\d{2}$/.test(reminder_time)) {
    return { ok: false, error: "Reminder time must be in HH:mm format" };
  }

  return {
    ok: true,
    data: {
      title,
      description: asString(b.description).trim(),
      schedule_type,
      task_date,
      start_date,
      end_date,
      repeat_days,
      priority,
      category_id: asString(b.category_id).trim(),
      tag_id: asString(b.tag_id).trim(),
      reminder_time,
      status,
    },
  };
}
