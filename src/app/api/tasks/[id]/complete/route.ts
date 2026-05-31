/**
 * Mark a date-specific task complete / reopen — driven by the All Tasks list.
 * PATCH /api/tasks/:id/complete   { completed: boolean }
 *
 * Daily / weekly rules are completed per-day from the Today screen, so this
 * route rejects them. Date-specific rules have a single fixed `task_date`,
 * which lets us upsert exactly one TaskInstance per (task, user).
 *
 * Completion writes only to `task_instances` — the parent Task rule is left
 * untouched so its schedule keeps working the same way it does for Today.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Task from "@/model/Task";
import TaskInstance from "@/model/TaskInstance";
import { toUtcMidnight } from "@/lib/task-schedule";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("today.complete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const completed = body?.completed;
    if (typeof completed !== "boolean") {
      return NextResponse.json(
        { success: false, error: "completed must be a boolean" },
        { status: 400 },
      );
    }

    const task = await Task.findOne({
      _id: id,
      assigned_to: session.user.id,
      deleted_at: null,
    }).lean<{
      _id: unknown;
      schedule_type: "date_specific" | "daily" | "weekly";
      task_date: Date | null;
    } | null>();

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    if (task.schedule_type !== "date_specific") {
      return NextResponse.json(
        {
          success: false,
          error: "Only date-specific tasks can be completed from this list",
        },
        { status: 400 },
      );
    }

    const taskDate = toUtcMidnight(task.task_date);
    if (!taskDate) {
      return NextResponse.json(
        { success: false, error: "Task is missing its scheduled date" },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const update = completed
      ? {
          status: "completed" as const,
          completed_at: new Date(),
          completed_by: { id: userId, name: session.user.name ?? "Unknown" },
        }
      : {
          status: "pending" as const,
          completed_at: null,
          completed_by: null,
        };

    const inst = await TaskInstance.findOneAndUpdate(
      { task_id: String(task._id), user_id: userId, task_date: taskDate },
      {
        $set: update,
        $setOnInsert: {
          task_id: String(task._id),
          user_id: userId,
          task_date: taskDate,
          remarks: "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const obj = inst.toObject();
    return NextResponse.json({
      success: true,
      data: { ...obj, id: String(obj._id) },
    });
  } catch (err) {
    console.error("PATCH /api/tasks/:id/complete", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update completion: ${message}` },
      { status: 500 },
    );
  }
}
