/**
 * Planner types — shared between the API layer, Mongoose models, and
 * the React Planner page.
 *
 * The planner is a weekly grid: each user owns a set of "blocks", and
 * every block recurs every week on a specific weekday between two times.
 * Per-day completion is recorded separately (`planner_completions`) so a
 * block can be ticked off without losing its recurrence.
 */

import type { AuditUser, Weekday } from "@/types/task";

export type PlannerPriority = "low" | "medium" | "high";

export type PlannerCompletionStatus = "completed" | "skipped";

export interface PlannerBlock {
  id: string;
  user_id: string;
  weekday: Weekday;
  /** "HH:mm" 24-hour. */
  start_time: string;
  /** "HH:mm" 24-hour. */
  end_time: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  priority: PlannerPriority;
  created_by: AuditUser;
  updated_by: AuditUser;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannerCompletion {
  id: string;
  block_id: string;
  user_id: string;
  /** ISO date (UTC midnight) — the calendar day. */
  plan_date: string;
  status: PlannerCompletionStatus;
  completed_at: string | null;
  completed_by: AuditUser | null;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Week-feed bucket — one weekday with its blocks and today's completion. */
export interface PlannerWeekBlock extends PlannerBlock {
  /** Completion record for the calendar date the block falls on this week. */
  completion: PlannerCompletion | null;
  /** ISO date the block falls on within the requested week. */
  occurs_on: string;
}

export interface PlannerWeekStats {
  total: number;
  completed: number;
  upcoming: number;
  current_streak: number;
}
