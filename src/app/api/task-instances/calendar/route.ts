/**
 * Calendar feed — expand the caller's task rules into per-day buckets.
 * GET /api/task-instances/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Defaults to the current month if `from`/`to` are omitted. Returns a
 * compact `[{ date, tasks: [...] }]` array, scoped to the calling user.
 *
 * Does not auto-create instances — that's only on the today's-tasks
 * endpoint.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Task from "@/model/Task";
import TaskInstance from "@/model/TaskInstance";
import type { TaskInstanceStatus } from "@/types/task";
import {
  eachDay,
  taskOccursOn,
  toIsoDate,
  toUtcMidnight,
} from "@/lib/task-schedule";

interface RawTaskRow {
  _id: unknown;
  title: string;
  schedule_type: "date_specific" | "daily" | "weekly" | "date_range";
  task_date: Date | null;
  start_date: Date | null;
  end_date: Date | null;
  repeat_days: number[];
  priority: "low" | "medium" | "high" | "urgent";
}

function defaultRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  return { from, to };
}

export async function GET(req: NextRequest) {
  const { error, session } = await requirePermission("tasks.calendar");
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const def = defaultRange();
    const from = toUtcMidnight(searchParams.get("from")) ?? def.from;
    const to = toUtcMidnight(searchParams.get("to")) ?? def.to;

    if (to.getTime() < from.getTime()) {
      return NextResponse.json(
        { success: false, error: "`to` must be on or after `from`" },
        { status: 400 },
      );
    }

    // Hard cap on range so a runaway query (years long) can't pin the server.
    const days = (to.getTime() - from.getTime()) / 86_400_000 + 1;
    if (days > 366) {
      return NextResponse.json(
        { success: false, error: "Range too large — max 366 days" },
        { status: 400 },
      );
    }

    // Pre-filter rules whose window intersects [from, to], scoped to caller.
    const rules: RawTaskRow[] = await Task.find({
      assigned_to: session.user.id,
      status: "Active",
      deleted_at: null,
      $or: [
        // Date-specific: the single date is inside the range.
        {
          schedule_type: "date_specific",
          task_date: { $gte: from, $lte: to },
        },
        // Daily/weekly: rule's window touches [from, to].
        {
          schedule_type: { $in: ["daily", "weekly"] },
          start_date: { $lte: to },
          $or: [{ end_date: null }, { end_date: { $gte: from } }],
        },
        // Date-range: window intersects [from, to] — both bounds required.
        {
          schedule_type: "date_range",
          start_date: { $lte: to },
          end_date: { $gte: from },
        },
      ],
    }).lean<RawTaskRow[]>();

    // Pull the caller's instances inside the same window so we can mark
    // each scheduled occurrence with its completion status.
    const instances = await TaskInstance.find({
      user_id: session.user.id,
      task_date: { $gte: from, $lte: to },
    })
      .select("task_id task_date status")
      .lean<
        { task_id: string; task_date: Date; status: TaskInstanceStatus }[]
      >();

    const statusByKey = new Map<string, TaskInstanceStatus>();
    for (const inst of instances) {
      statusByKey.set(
        `${String(inst.task_id)}|${toIsoDate(inst.task_date)}`,
        inst.status,
      );
    }

    // date_range rules are single-instance: one TaskInstance covers every
    // day in the window. Build a task_id → status overlay (regardless of
    // the day being walked) so the calendar paints the whole range with
    // its completion state.
    const rangeRuleIds = rules
      .filter((r) => r.schedule_type === "date_range")
      .map((r) => String(r._id));
    const rangeStatusByTask = new Map<string, TaskInstanceStatus>();
    if (rangeRuleIds.length > 0) {
      const rangeInstances = await TaskInstance.find({
        user_id: session.user.id,
        task_id: { $in: rangeRuleIds },
      })
        .select("task_id status")
        .lean<{ task_id: string; status: TaskInstanceStatus }[]>();
      for (const inst of rangeInstances) {
        rangeStatusByTask.set(String(inst.task_id), inst.status);
      }
    }

    // Walk the range, ask each rule "do you fire today?".
    const buckets: Array<{
      date: string;
      tasks: Array<{
        id: string;
        title: string;
        priority: string;
        schedule_type: string;
        status: TaskInstanceStatus | null;
      }>;
    }> = [];

    for (const day of eachDay(from, to)) {
      const dayIso = toIsoDate(day);
      const tasks = rules
        .filter((rule) => taskOccursOn(rule, day))
        .map((rule) => ({
          id: String(rule._id),
          title: rule.title,
          priority: rule.priority,
          schedule_type: rule.schedule_type,
          status:
            rule.schedule_type === "date_range"
              ? rangeStatusByTask.get(String(rule._id)) ?? null
              : statusByKey.get(`${String(rule._id)}|${dayIso}`) ?? null,
        }));
      buckets.push({ date: dayIso, tasks });
    }

    return NextResponse.json({ success: true, data: buckets });
  } catch (err) {
    console.error("GET /api/task-instances/calendar", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to load calendar: ${message}` },
      { status: 500 },
    );
  }
}
