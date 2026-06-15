/**
 * task-schedule.ts — single source of truth for task date / schedule logic.
 *
 * Used by:
 *   - /api/task-instances/today      (matches active tasks against today)
 *   - /api/task-instances/calendar   (expands rules into a date range)
 *   - All Tasks page                 (renders the "schedule summary" cell)
 *   - Today's Tasks page             (display only)
 *
 * Centralizing the matching logic guarantees the calendar, today's view,
 * and the rule list stay in lock-step — if the rule says "every Sunday",
 * every surface agrees on which days are Sundays.
 */

import type {
  Task,
  TaskScheduleType,
  Weekday,
} from "@/types/task";

// ──────────────────────────────────────────────────────────────────────
// Date utilities — every comparison happens on UTC-midnight Date objects
// or "YYYY-MM-DD" strings, so DST and timezone drift can't shift a task
// onto the wrong calendar day.
// ──────────────────────────────────────────────────────────────────────

/** Strip a Date down to UTC midnight — the canonical "calendar day" form. */
export function toUtcMidnight(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

/** "YYYY-MM-DD" — never locale-shifted. */
export function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Today as UTC-midnight Date. */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Walk a date range inclusively, yielding UTC-midnight Dates. */
export function* eachDay(from: Date, to: Date): Generator<Date> {
  const start = toUtcMidnight(from)!;
  const end = toUtcMidnight(to)!;
  for (
    let cur = new Date(start);
    cur.getTime() <= end.getTime();
    cur = new Date(cur.getTime() + 86400000)
  ) {
    yield new Date(cur);
  }
}

/** Sun=0 … Sat=6, as required by `repeat_days`. */
export function weekdayOf(d: Date): Weekday {
  return d.getUTCDay() as Weekday;
}

// ──────────────────────────────────────────────────────────────────────
// Schedule matching — does a given task occur on a given calendar day?
// ──────────────────────────────────────────────────────────────────────

interface ScheduleRule {
  schedule_type: TaskScheduleType;
  task_date?: Date | string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  repeat_days?: number[];
}

/**
 * True iff the rule's schedule says it occurs on `day`. Pure function;
 * does not consult `status` or `deleted_at` — callers filter those
 * separately so this stays cheap to call for every (task, day) pair.
 */
export function taskOccursOn(rule: ScheduleRule, day: Date): boolean {
  const target = toUtcMidnight(day);
  if (!target) return false;
  const t = target.getTime();

  // Anytime tasks have no schedule — they're surfaced by the Today route
  // in their own "Anytime" section, never matched against a calendar day.
  if (rule.schedule_type === "anytime") return false;

  if (rule.schedule_type === "date_specific") {
    const taskDay = toUtcMidnight(rule.task_date ?? null);
    return !!taskDay && taskDay.getTime() === t;
  }

  const start = toUtcMidnight(rule.start_date ?? null);
  if (!start || start.getTime() > t) return false;

  const end = toUtcMidnight(rule.end_date ?? null);
  if (end && end.getTime() < t) return false;

  if (rule.schedule_type === "daily") return true;

  if (rule.schedule_type === "weekly") {
    const wd = weekdayOf(target);
    return Array.isArray(rule.repeat_days) && rule.repeat_days.includes(wd);
  }

  // date_range: fires every day inside [start_date, end_date]. The earlier
  // start/end gates already handled the window; just confirm the bracket
  // shape (end is required for a range rule).
  if (rule.schedule_type === "date_range") return !!end;

  return false;
}

/**
 * For a rule that's modelled as "one instance covers the whole window"
 * (date_range and anytime), return the canonical task_date used for
 * that single TaskInstance. Returns null when the rule isn't single-
 * instance or when the dates are missing.
 *
 * Anytime tasks have no deadline; the API seeds `start_date` to the
 * creation day so each (task, user) still has a stable canonical
 * task_date for the unique TaskInstance index.
 */
export function singleInstanceDate(rule: ScheduleRule): Date | null {
  if (rule.schedule_type !== "date_range" && rule.schedule_type !== "anytime") {
    return null;
  }
  return toUtcMidnight(rule.start_date ?? null);
}

// ──────────────────────────────────────────────────────────────────────
// Schedule summary — the human label rendered in tables / cards.
//   - "05 May 2026"
//   - "Every day from 01 May 2026"
//   - "Every Sunday"
//   - "Every Sunday and Wednesday until 30 June 2026"
// ──────────────────────────────────────────────────────────────────────

const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "05 May 2026" — short month, day-first; matches the spec's examples. */
export function formatTaskDate(d: Date | string | null | undefined): string {
  const date = toUtcMidnight(d);
  if (!date) return "";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const m = MONTHS_SHORT[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return `${dd} ${m} ${y}`;
}

/** Join a list with Oxford-comma + "and": ["Sun"] → "Sun"; ["Sun","Wed"] → "Sun and Wed". */
function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function formatScheduleSummary(
  rule: Pick<
    Task,
    "schedule_type" | "task_date" | "start_date" | "end_date" | "repeat_days"
  >,
): string {
  switch (rule.schedule_type) {
    case "date_specific":
      return formatTaskDate(rule.task_date);

    case "daily": {
      const start = formatTaskDate(rule.start_date);
      const end = formatTaskDate(rule.end_date);
      if (!start) return "Every day";
      return end
        ? `Every day from ${start} until ${end}`
        : `Every day from ${start}`;
    }

    case "weekly": {
      const days = (rule.repeat_days ?? []).slice().sort((a, b) => a - b);
      // Use full weekday names for 1–2 days (more readable); short for 3+.
      const labels =
        days.length <= 2
          ? days.map((d) => WEEKDAY_FULL[d])
          : days.map((d) => WEEKDAY_SHORT[d]);
      const dayPart = joinList(labels);
      const end = formatTaskDate(rule.end_date);
      const base = dayPart ? `Every ${dayPart}` : "Weekly";
      return end ? `${base} until ${end}` : base;
    }

    case "date_range": {
      const start = formatTaskDate(rule.start_date);
      const end = formatTaskDate(rule.end_date);
      if (!start || !end) return "Date range";
      return `From ${start} to ${end}`;
    }

    case "anytime":
      return "Anytime — no deadline";

    default:
      return "";
  }
}

/** Helper text shown directly under the schedule-type radio in the modal. */
export function helperFor(
  rule: Pick<
    Task,
    "schedule_type" | "task_date" | "start_date" | "end_date" | "repeat_days"
  >,
): string {
  switch (rule.schedule_type) {
    case "date_specific":
      return rule.task_date
        ? `This task will appear only on ${formatTaskDate(rule.task_date)}.`
        : "Pick the date this task should appear.";

    case "daily":
      if (!rule.start_date) return "Pick a start date — task repeats every day.";
      return rule.end_date
        ? `This task will appear every day from ${formatTaskDate(rule.start_date)} until ${formatTaskDate(rule.end_date)}.`
        : `This task will appear every day from ${formatTaskDate(rule.start_date)}.`;

    case "weekly": {
      const days = (rule.repeat_days ?? []).slice().sort((a, b) => a - b);
      if (days.length === 0) return "Pick at least one weekday.";
      if (!rule.start_date) return "Pick a start date and the weekdays.";
      const summary = formatScheduleSummary(rule);
      return `This task will appear ${summary.replace(/^Every /, "every ")}.`;
    }

    case "date_range": {
      if (!rule.start_date || !rule.end_date)
        return "Pick a from-date and a to-date — task appears every day until you check it off.";
      return `This task will appear every day from ${formatTaskDate(rule.start_date)} to ${formatTaskDate(rule.end_date)}. Checking it off marks it done for the whole range.`;
    }

    case "anytime":
      return "No deadline — this task stays in your Anytime list on the Today screen until you check it off.";

    default:
      return "";
  }
}

export const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string; short: string }> = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];
