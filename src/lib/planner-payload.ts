/**
 * planner-payload.ts — server-side validation & normalisation for the
 * planner block create/update payload.
 */

import type { Weekday } from "@/types/task";
import type { PlannerPriority } from "@/types/planner";

const PRIORITIES: PlannerPriority[] = ["low", "medium", "high"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ValidatedPlannerBlock {
  weekday: Weekday;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  priority: PlannerPriority;
}

export type ValidationResult =
  | { ok: true; data: ValidatedPlannerBlock }
  | { ok: false; error: string };

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Convert "HH:mm" to minutes-from-midnight. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function validatePlannerBlockPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const b = raw as Record<string, unknown>;

  const title = asString(b.title).trim();
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > 160)
    return { ok: false, error: "Title must be 160 characters or less" };

  const weekdayRaw = Number(b.weekday);
  if (!Number.isInteger(weekdayRaw) || weekdayRaw < 0 || weekdayRaw > 6) {
    return { ok: false, error: "Weekday must be 0 (Sun) – 6 (Sat)" };
  }
  const weekday = weekdayRaw as Weekday;

  const start_time = asString(b.start_time).trim();
  const end_time = asString(b.end_time).trim();
  if (!TIME_RE.test(start_time)) {
    return { ok: false, error: "Start time must be HH:mm (00:00 – 23:59)" };
  }
  if (!TIME_RE.test(end_time)) {
    return { ok: false, error: "End time must be HH:mm (00:00 – 23:59)" };
  }
  if (minutesOf(end_time) <= minutesOf(start_time)) {
    return { ok: false, error: "End time must be after start time" };
  }

  const priority = (b.priority as PlannerPriority) ?? "medium";
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, error: "Invalid priority" };
  }

  const color = asString(b.color).trim() || "#059669";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { ok: false, error: "Color must be a #RRGGBB hex string" };
  }

  return {
    ok: true,
    data: {
      weekday,
      start_time,
      end_time,
      title,
      description: asString(b.description).trim().slice(0, 1000),
      color,
      icon: asString(b.icon).trim().slice(0, 32),
      priority,
    },
  };
}
