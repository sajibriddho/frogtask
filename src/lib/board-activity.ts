/**
 * board-activity.ts — fire-and-forget helper for the activity log.
 *
 * Mutation routes call this after a successful write. We never await it
 * inside the request hot path (see `recordActivity`) so a logging
 * hiccup can never wedge a user-facing operation. Errors are swallowed
 * but printed to the server console for diagnostics.
 */

import ProjectActivity from "@/model/ProjectActivity";

export interface ActivityInput {
  board_id: string;
  card_id?: string | null;
  user_id: string;
  user_name: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export function recordActivity(input: ActivityInput): void {
  // Cast to unknown first so TS doesn't complain about the `void` cast
  // when we deliberately throw the promise away.
  void ProjectActivity.create({
    board_id: input.board_id,
    card_id: input.card_id ?? null,
    user_id: input.user_id,
    user_name: input.user_name,
    action: input.action,
    description: input.description,
    metadata: input.metadata ?? {},
  }).catch((err) => {
    console.error("activity-log write failed", err);
  });
}

/** Slugify helper used when creating a board. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "board";
}

/** New mid-point for inserting an item between two adjacent rows. */
export function midpoint(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return 1024;
  if (prev == null) return (next as number) - 1024;
  if (next == null) return prev + 1024;
  return (prev + next) / 2;
}
