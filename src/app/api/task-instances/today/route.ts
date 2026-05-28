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
import { taskOccursOn, todayUtc, weekdayOf } from "@/lib/task-schedule";

interface RawTaskRow {
  _id: unknown;
  title: string;
  schedule_type: "date_specific" | "daily" | "weekly";
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
    const wd = weekdayOf(today);
    const userId = session.user.id;

    // Step 1: pull every active rule assigned to me that *could* match today
    // — i.e. matches the date window. Final weekday-list filter happens in JS
    // because $expr inside $or with $in for repeat_days isn't necessary when
    // we're already iterating in memory.
    const candidateRules: RawTaskRow[] = await Task.find({
      assigned_to: userId,
      status: "Active",
      deleted_at: null,
      $or: [
        { schedule_type: "date_specific", task_date: today },
        {
          schedule_type: "daily",
          start_date: { $lte: today },
          $or: [{ end_date: null }, { end_date: { $gte: today } }],
        },
        {
          schedule_type: "weekly",
          repeat_days: wd,
          start_date: { $lte: today },
          $or: [{ end_date: null }, { end_date: { $gte: today } }],
        },
      ],
    }).lean<RawTaskRow[]>();

    // Step 2: belt-and-braces — re-check via the pure JS matcher so the
    // calendar and the today list can never disagree about whether a rule
    // fires today.
    const matched = candidateRules.filter((rule) => taskOccursOn(rule, today));

    if (matched.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Step 3: find existing instances in one query, then bulk-create any missing.
    const matchedIds = matched.map((r) => String(r._id));
    const existing = await TaskInstance.find({
      task_id: { $in: matchedIds },
      user_id: userId,
      task_date: today,
    }).lean();

    const haveByTask = new Map(
      existing.map((i) => [String(i.task_id), i]),
    );

    const toCreate = matched
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
      task_id: { $in: matchedIds },
      user_id: userId,
      task_date: today,
    }).lean<{ _id: unknown; task_id: string; [k: string]: unknown }[]>();

    const instanceByTask = new Map(
      allInstances.map((i) => [String(i.task_id), i]),
    );

    const data = matched.map((rule) => {
      const inst = instanceByTask.get(String(rule._id));
      return {
        ...rule,
        id: String(rule._id),
        instance: inst
          ? { ...inst, id: String(inst._id) }
          : null,
      };
    });

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
