/**
 * Planner Completions API.
 * POST   /api/planner/completions   Mark a block complete (or skipped) for
 *                                   a specific date. Upserts so re-marking
 *                                   the same day is idempotent.
 * DELETE /api/planner/completions?block_id=...&plan_date=YYYY-MM-DD
 *                                   Reopen a completed block — removes the
 *                                   completion record so the slot is open
 *                                   again.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import PlannerBlock from "@/model/PlannerBlock";
import PlannerCompletion, {
  type PlannerCompletionStatus,
} from "@/model/PlannerCompletion";
import { toUtcMidnight } from "@/lib/task-schedule";

const STATUSES: PlannerCompletionStatus[] = ["completed", "skipped"];

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("planner.complete");
  if (error) return error;

  try {
    await connectDB();
    const body = (await req.json()) as Record<string, unknown>;

    const blockId = typeof body.block_id === "string" ? body.block_id : "";
    if (!blockId) {
      return NextResponse.json(
        { success: false, error: "block_id is required" },
        { status: 400 },
      );
    }

    const planDate = toUtcMidnight(
      (body.plan_date as string | null | undefined) ?? null,
    );
    if (!planDate) {
      return NextResponse.json(
        { success: false, error: "plan_date (YYYY-MM-DD) is required" },
        { status: 400 },
      );
    }

    const status: PlannerCompletionStatus =
      (body.status as PlannerCompletionStatus) ?? "completed";
    if (!STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    // Verify the user owns the block.
    const block = await PlannerBlock.findOne({
      _id: blockId,
      user_id: session.user.id,
    }).lean<{ _id: unknown; weekday: number } | null>();
    if (!block) {
      return NextResponse.json(
        { success: false, error: "Planner block not found" },
        { status: 404 },
      );
    }

    // Sanity check: the plan_date must fall on the block's weekday.
    if (planDate.getUTCDay() !== block.weekday) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan date does not match the block's weekday",
        },
        { status: 400 },
      );
    }

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const note =
      typeof body.note === "string" ? body.note.slice(0, 500) : "";

    const completion = await PlannerCompletion.findOneAndUpdate(
      {
        block_id: blockId,
        user_id: session.user.id,
        plan_date: planDate,
      },
      {
        $set: {
          status,
          completed_at: status === "completed" ? new Date() : null,
          completed_by: status === "completed" ? actor : null,
          note,
        },
        $setOnInsert: {
          block_id: blockId,
          user_id: session.user.id,
          plan_date: planDate,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    const obj = completion.toObject();
    return NextResponse.json(
      { success: true, data: { ...obj, id: String(obj._id) } },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/planner/completions", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update completion: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { error, session } = await requirePermission("planner.complete");
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const blockId = (searchParams.get("block_id") ?? "").trim();
    const planDateStr = (searchParams.get("plan_date") ?? "").trim();

    if (!blockId) {
      return NextResponse.json(
        { success: false, error: "block_id is required" },
        { status: 400 },
      );
    }
    const planDate = toUtcMidnight(planDateStr);
    if (!planDate) {
      return NextResponse.json(
        { success: false, error: "plan_date (YYYY-MM-DD) is required" },
        { status: 400 },
      );
    }

    await PlannerCompletion.deleteOne({
      block_id: blockId,
      user_id: session.user.id,
      plan_date: planDate,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/planner/completions", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to reopen completion: ${message}` },
      { status: 500 },
    );
  }
}
