/**
 * Planner Week API.
 * GET /api/planner/week?start=YYYY-MM-DD
 *
 * Returns every planner block the caller owns, each tagged with the calendar
 * date it falls on within the requested week (Sunday = `start`), plus the
 * matching PlannerCompletion record if one exists. The "week" view in the UI
 * is rendered straight from this response.
 *
 * Also computes lightweight discipline stats: total blocks for the week,
 * how many are already completed, how many are still upcoming, and the
 * user's current daily completion streak (consecutive days, ending on
 * today, where the user completed every block scheduled for that day).
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import PlannerBlock from "@/model/PlannerBlock";
import PlannerCompletion from "@/model/PlannerCompletion";
import { toIsoDate, toUtcMidnight, todayUtc } from "@/lib/task-schedule";

interface RawBlock {
  _id: unknown;
  user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  priority: string;
  [k: string]: unknown;
}

interface RawCompletion {
  _id: unknown;
  block_id: string;
  user_id: string;
  plan_date: Date;
  status: string;
  [k: string]: unknown;
}

/** Walk back from `today` and count consecutive days where every scheduled
 *  block was completed. A day with no scheduled blocks is treated as "no
 *  data" and breaks the streak (the user has to actually plan + do). */
function computeStreak(
  blocks: RawBlock[],
  completions: RawCompletion[],
  today: Date,
): number {
  if (blocks.length === 0) return 0;
  const completedSet = new Set(
    completions
      .filter((c) => c.status === "completed")
      .map(
        (c) => `${String(c.block_id)}|${toIsoDate(c.plan_date)}`,
      ),
  );

  const byWeekday = new Map<number, string[]>();
  for (const b of blocks) {
    const list = byWeekday.get(b.weekday) ?? [];
    list.push(String(b._id));
    byWeekday.set(b.weekday, list);
  }

  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const cursor = new Date(today.getTime() - i * 86400000);
    const wd = cursor.getUTCDay();
    const ids = byWeekday.get(wd);
    if (!ids || ids.length === 0) break;
    const iso = toIsoDate(cursor);
    const allDone = ids.every((id) => completedSet.has(`${id}|${iso}`));
    if (!allDone) break;
    streak++;
  }
  return streak;
}

export async function GET(req: NextRequest) {
  const { error, session } = await requirePermission("planner");
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const startParam = (searchParams.get("start") ?? "").trim();
    let weekStart = toUtcMidnight(startParam || null);
    if (!weekStart) {
      // Default to the Sunday of the current week (UTC).
      const today = todayUtc();
      const dow = today.getUTCDay();
      weekStart = new Date(today.getTime() - dow * 86400000);
    } else {
      // Snap to the Sunday of that week to keep the grid consistent.
      const dow = weekStart.getUTCDay();
      weekStart = new Date(weekStart.getTime() - dow * 86400000);
    }
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

    const blocks = await PlannerBlock.find({ user_id: session.user.id })
      .sort({ weekday: 1, start_time: 1 })
      .lean<RawBlock[]>();

    const completions = await PlannerCompletion.find({
      user_id: session.user.id,
      plan_date: { $gte: weekStart, $lt: weekEnd },
    }).lean<RawCompletion[]>();

    const completionByKey = new Map<string, RawCompletion>();
    for (const c of completions) {
      completionByKey.set(
        `${String(c.block_id)}|${toIsoDate(c.plan_date)}`,
        c,
      );
    }

    const today = todayUtc();
    const todayIso = toIsoDate(today);

    const items = blocks.map((b) => {
      const occurDate = new Date(
        weekStart.getTime() + b.weekday * 86400000,
      );
      const occursOn = toIsoDate(occurDate);
      const key = `${String(b._id)}|${occursOn}`;
      const comp = completionByKey.get(key) ?? null;
      return {
        ...b,
        id: String(b._id),
        occurs_on: occursOn,
        completion: comp
          ? { ...comp, id: String(comp._id) }
          : null,
      };
    });

    // Stats for this week
    const weekCompleted = items.filter(
      (i) => i.completion?.status === "completed",
    ).length;
    const upcoming = items.filter(
      (i) => !i.completion && i.occurs_on >= todayIso,
    ).length;

    // For streak we need a wider completion window — last 60 days.
    const streakWindowStart = new Date(today.getTime() - 60 * 86400000);
    const streakCompletions = await PlannerCompletion.find({
      user_id: session.user.id,
      plan_date: { $gte: streakWindowStart, $lte: today },
    }).lean<RawCompletion[]>();
    const currentStreak = computeStreak(blocks, streakCompletions, today);

    return NextResponse.json({
      success: true,
      data: {
        week_start: toIsoDate(weekStart),
        items,
        stats: {
          total: items.length,
          completed: weekCompleted,
          upcoming,
          current_streak: currentStreak,
        },
      },
    });
  } catch (err) {
    console.error("GET /api/planner/week", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to load planner week: ${message}` },
      { status: 500 },
    );
  }
}
