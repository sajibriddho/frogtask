/**
 * Today's Tasks API.
 * GET /api/task-instances/today
 *
 * Returns every active task assigned to the caller whose schedule rule
 * fires today, **plus** the user's TaskInstance for today (auto-created
 * if missing). Marking the instance complete only writes to
 * task_instances — never to the parent rule.
 */

import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Task from "@/model/Task";
import TaskInstance from "@/model/TaskInstance";
import {
  eachDay,
  singleInstanceDate,
  taskOccursOn,
  todayUtc,
  toUtcMidnight,
} from "@/lib/task-schedule";

// How far back to lazily create missing pending instances on /today load.
// A user returning after a long absence sees at most this many days of
// carry-over in the Unfinished tab — anything older is silently skipped.
const BACKFILL_DAYS = 30;

interface RawTaskRow {
  _id: unknown;
  title: string;
  schedule_type:
    | "date_specific"
    | "daily"
    | "weekly"
    | "date_range"
    | "anytime";
  task_date: Date | null;
  start_date: Date | null;
  end_date: Date | null;
  repeat_days: number[];
  assigned_to: string;
  priority: string;
  status: string;
  deleted_at: Date | null;
  [key: string]: unknown;
}

export async function GET() {
  const { error, session } = await requirePermission("today");
  if (error) return error;

  try {
    await connectDB();

    const today = todayUtc();
    const userId = session.user.id;
    const backfillStart = new Date(today.getTime() - BACKFILL_DAYS * 86400000);
    const yesterday = new Date(today.getTime() - 86400000);

    // Step 1: pull every active assigned rule. We filter to today's matches
    // and backfill-window matches in JS — the schedule matcher is the single
    // source of truth used by /calendar and /today, so the query stays broad.
    const activeRules: RawTaskRow[] = await Task.find({
      assigned_to: userId,
      status: "Active",
      deleted_at: null,
    }).lean<RawTaskRow[]>();

    // Step 2: derive today's matches via the pure JS matcher so the calendar
    // and the today list can never disagree about whether a rule fires today.
    const matched = activeRules.filter((rule) => taskOccursOn(rule, today));

    // Step 2b: backfill — for every active rule, walk the past BACKFILL_DAYS
    // and lazy-create a pending instance for any day the rule fires but no
    // instance exists yet. This is what makes a daily/weekly task show up in
    // the Unfinished tab even on days the user never opened the app.
    type BackfillTarget = { task_id: string; task_date: Date };
    const backfillTargets: BackfillTarget[] = [];
    for (const rule of activeRules) {
      // Daily tasks are intentionally excluded from the Unfinished tab —
      // missing one occurrence of an everyday task isn't actionable; only
      // today's instance matters. Date-range tasks are single-instance:
      // they live on the today view until the user checks them off, so no
      // per-day backfill is needed.
      if (rule.schedule_type === "daily") continue;
      if (rule.schedule_type === "date_range") continue;
      // Anytime tasks have no calendar day — no per-day backfill.
      if (rule.schedule_type === "anytime") continue;
      const ruleStart = toUtcMidnight(rule.start_date ?? null);
      const ruleEnd = toUtcMidnight(rule.end_date ?? null);
      // Daily/weekly without a start_date don't really happen, but if so the
      // window is just the backfill window.
      const winStart =
        ruleStart && ruleStart.getTime() > backfillStart.getTime()
          ? ruleStart
          : backfillStart;
      const winEnd =
        ruleEnd && ruleEnd.getTime() < yesterday.getTime() ? ruleEnd : yesterday;
      if (winStart.getTime() > winEnd.getTime()) continue;
      for (const day of eachDay(winStart, winEnd)) {
        if (taskOccursOn(rule, day)) {
          backfillTargets.push({ task_id: String(rule._id), task_date: day });
        }
      }
    }

    if (backfillTargets.length > 0) {
      const distinctTaskIds = Array.from(
        new Set(backfillTargets.map((b) => b.task_id)),
      );
      const existingPast = await TaskInstance.find({
        user_id: userId,
        task_id: { $in: distinctTaskIds },
        task_date: { $gte: backfillStart, $lt: today },
      })
        .select({ task_id: 1, task_date: 1 })
        .lean<{ task_id: string; task_date: Date }[]>();

      const have = new Set(
        existingPast.map(
          (i) =>
            `${String(i.task_id)}|${(i.task_date as Date).toISOString().slice(0, 10)}`,
        ),
      );
      const toBackfill = backfillTargets
        .filter(
          (b) => !have.has(`${b.task_id}|${b.task_date.toISOString().slice(0, 10)}`),
        )
        .map((b) => ({
          task_id: b.task_id,
          user_id: userId,
          task_date: b.task_date,
          status: "pending" as const,
          completed_at: null,
          completed_by: null,
          remarks: "",
        }));

      if (toBackfill.length > 0) {
        try {
          await TaskInstance.insertMany(toBackfill, { ordered: false });
        } catch (insertErr) {
          // Unique-index race with another tab — treat as success.
          const code = (insertErr as { code?: number })?.code;
          if (code !== 11000) throw insertErr;
        }
      }
    }

    // Step 3: find existing instances in one query, then bulk-create any
    // missing. Two shapes co-exist:
    //   - per-day rules (date_specific, daily, weekly): one instance per day,
    //     keyed by task_date == today.
    //   - single-instance rules (date_range): one instance covers the whole
    //     window, keyed by task_date == rule.start_date. Checking it off
    //     marks the task done for every day of the range.
    const instanceByTask = new Map<
      string,
      { _id: unknown; task_id: string; [k: string]: unknown }
    >();

    // — per-day —
    const perDayMatched = matched.filter(
      (r) => r.schedule_type !== "date_range",
    );
    const perDayIds = perDayMatched.map((r) => String(r._id));
    if (perDayIds.length > 0) {
      const existing = await TaskInstance.find({
        task_id: { $in: perDayIds },
        user_id: userId,
        task_date: today,
      }).lean();

      const haveByTask = new Map(
        existing.map((i) => [String(i.task_id), i]),
      );

      const toCreate = perDayMatched
        .filter((rule) => !haveByTask.has(String(rule._id)))
        .map((rule) => ({
          task_id: String(rule._id),
          user_id: userId,
          task_date: today,
          status: "pending" as const,
          completed_at: null,
          completed_by: null,
          remarks: "",
        }));

      if (toCreate.length > 0) {
        // ordered:false so a transient unique-index race for one row doesn't
        // abort the whole batch (any other browser tab calling /today at the
        // same instant would lose the race and we'd skip its inserts).
        try {
          await TaskInstance.insertMany(toCreate, { ordered: false });
        } catch (insertErr) {
          // Mongo's bulk write throws on duplicates even with ordered:false;
          // we treat that as success and re-read.
          const code = (insertErr as { code?: number })?.code;
          if (code !== 11000) throw insertErr;
        }
      }

      const allInstances = await TaskInstance.find({
        task_id: { $in: perDayIds },
        user_id: userId,
        task_date: today,
      }).lean<{ _id: unknown; task_id: string; [k: string]: unknown }[]>();

      for (const i of allInstances) instanceByTask.set(String(i.task_id), i);
    }

    // — single-instance (date_range) —
    const rangeMatched = matched.filter(
      (r) => r.schedule_type === "date_range",
    );
    if (rangeMatched.length > 0) {
      const rangeIds = rangeMatched.map((r) => String(r._id));
      const existingRange = await TaskInstance.find({
        task_id: { $in: rangeIds },
        user_id: userId,
      }).lean<{ _id: unknown; task_id: string; [k: string]: unknown }[]>();

      const haveByTask = new Map(
        existingRange.map((i) => [String(i.task_id), i]),
      );

      const toCreate: Array<Record<string, unknown>> = [];
      for (const rule of rangeMatched) {
        if (haveByTask.has(String(rule._id))) continue;
        const canonical = singleInstanceDate(rule);
        if (!canonical) continue;
        toCreate.push({
          task_id: String(rule._id),
          user_id: userId,
          task_date: canonical,
          status: "pending" as const,
          completed_at: null,
          completed_by: null,
          remarks: "",
        });
      }

      if (toCreate.length > 0) {
        try {
          await TaskInstance.insertMany(toCreate, { ordered: false });
        } catch (insertErr) {
          const code = (insertErr as { code?: number })?.code;
          if (code !== 11000) throw insertErr;
        }
      }

      const allRange = await TaskInstance.find({
        task_id: { $in: rangeIds },
        user_id: userId,
      }).lean<{ _id: unknown; task_id: string; [k: string]: unknown }[]>();
      for (const i of allRange) instanceByTask.set(String(i.task_id), i);
    }

    const todayData = matched.map((rule) => {
      const inst = instanceByTask.get(String(rule._id));
      return {
        ...rule,
        id: String(rule._id),
        instance: inst
          ? { ...inst, id: String(inst._id) }
          : null,
      };
    });

    // — anytime (no deadline) —
    // One TaskInstance per (task, user), keyed by the rule's start_date which
    // we seeded to the creation day in the payload validator. Always surfaced,
    // never matched against today's calendar day.
    const anytimeRules = activeRules.filter(
      (r) => r.schedule_type === "anytime",
    );
    const anytimeData: Array<Record<string, unknown>> = [];
    if (anytimeRules.length > 0) {
      const anytimeIds = anytimeRules.map((r) => String(r._id));
      const existingAnytime = await TaskInstance.find({
        task_id: { $in: anytimeIds },
        user_id: userId,
      }).lean<{ _id: unknown; task_id: string; [k: string]: unknown }[]>();

      const haveByTask = new Map(
        existingAnytime.map((i) => [String(i.task_id), i]),
      );

      const toCreate: Array<Record<string, unknown>> = [];
      for (const rule of anytimeRules) {
        if (haveByTask.has(String(rule._id))) continue;
        const canonical = singleInstanceDate(rule);
        if (!canonical) continue;
        toCreate.push({
          task_id: String(rule._id),
          user_id: userId,
          task_date: canonical,
          status: "pending" as const,
          completed_at: null,
          completed_by: null,
          remarks: "",
        });
      }

      if (toCreate.length > 0) {
        try {
          await TaskInstance.insertMany(toCreate, { ordered: false });
        } catch (insertErr) {
          const code = (insertErr as { code?: number })?.code;
          if (code !== 11000) throw insertErr;
        }
      }

      const allAnytime = await TaskInstance.find({
        task_id: { $in: anytimeIds },
        user_id: userId,
      }).lean<{ _id: unknown; task_id: string; [k: string]: unknown }[]>();
      const anytimeInstByTask = new Map<
        string,
        { _id: unknown; task_id: string; [k: string]: unknown }
      >();
      for (const i of allAnytime) anytimeInstByTask.set(String(i.task_id), i);

      for (const rule of anytimeRules) {
        const inst = anytimeInstByTask.get(String(rule._id));
        anytimeData.push({
          ...rule,
          id: String(rule._id),
          instance: inst ? { ...inst, id: String(inst._id) } : null,
          is_anytime: true,
        });
      }
    }

    // Step 4: pull any past instances still unfinished. These keep showing up
    // on the today screen (flagged as overdue) until the user marks them done,
    // skipped, or cancelled.
    const pastInstances = await TaskInstance.find({
      user_id: userId,
      task_date: { $lt: today },
      status: { $in: ["pending", "in_progress"] },
    })
      .sort({ task_date: 1 })
      .lean<{ _id: unknown; task_id: string; task_date: Date; [k: string]: unknown }[]>();

    let overdueData: Array<Record<string, unknown>> = [];
    if (pastInstances.length > 0) {
      const pastTaskIds = Array.from(
        new Set(pastInstances.map((i) => String(i.task_id))),
      );
      // Parent task lookup — skip deleted tasks; ignore Active/Inactive so
      // the user can still close out instances created before deactivation.
      const pastTasks = await Task.find({
        _id: { $in: pastTaskIds },
        deleted_at: null,
      }).lean<RawTaskRow[]>();
      const pastTaskById = new Map(pastTasks.map((t) => [String(t._id), t]));

      overdueData = pastInstances
        .filter((inst) => {
          const rule = pastTaskById.get(String(inst.task_id));
          if (!rule) return false;
          // Daily tasks reset every day, so a missed occurrence isn't
          // actionable as overdue. Date-range tasks are single-instance:
          // their canonical task_date is the start of the window, so the
          // "past instance" check trips even while they're still in range —
          // those are already surfaced above via instanceByTask.
          if (rule.schedule_type === "daily") return false;
          if (rule.schedule_type === "date_range") return false;
          // Anytime tasks have no deadline — they live in the Anytime
          // section perpetually, never as overdue.
          if (rule.schedule_type === "anytime") return false;
          return true;
        })
        .map((inst) => {
          const rule = pastTaskById.get(String(inst.task_id))!;
          const taskDate = inst.task_date instanceof Date
            ? inst.task_date
            : new Date(inst.task_date as string);
          return {
            ...rule,
            id: String(rule._id),
            instance: { ...inst, id: String(inst._id) },
            is_overdue: true,
            overdue_date: taskDate.toISOString().slice(0, 10),
          };
        });
    }

    // Overdue first so users notice them at the top of each tag group.
    // Anytime tasks tail the response — the Today UI splits them into a
    // dedicated section after Unfinished.
    const data = [...overdueData, ...todayData, ...anytimeData];

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/task-instances/today", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to load today's tasks: ${message}` },
      { status: 500 },
    );
  }
}
