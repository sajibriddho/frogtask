/**
 * Update a single task instance — typically the "mark as complete" flow.
 * PATCH /api/task-instances/:id   { status, remarks? }
 *
 * Only the user the instance belongs to may modify it. Completing here
 * does NOT touch the parent Task — daily / weekly schedules keep running
 * regardless of today's outcome.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import TaskInstance from "@/model/TaskInstance";
import type { TaskInstanceStatus } from "@/types/task";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ALLOWED_STATUSES: TaskInstanceStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
  "cancelled",
];

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("today.complete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const status = body?.status as TaskInstanceStatus | undefined;
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid instance status" },
        { status: 400 },
      );
    }

    const remarks =
      typeof body?.remarks === "string"
        ? body.remarks.slice(0, 1000)
        : undefined;

    const update: Record<string, unknown> = {};
    if (status) {
      update.status = status;
      if (status === "completed") {
        update.completed_at = new Date();
        update.completed_by = {
          id: session.user.id,
          name: session.user.name ?? "Unknown",
        };
      } else {
        // Re-opening a previously completed task clears the completion stamp.
        update.completed_at = null;
        update.completed_by = null;
      }
    }
    if (remarks !== undefined) update.remarks = remarks;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: "Nothing to update" },
        { status: 400 },
      );
    }

    const inst = await TaskInstance.findOneAndUpdate(
      { _id: id, user_id: session.user.id },
      update,
      { returnDocument: "after" },
    );

    if (!inst) {
      return NextResponse.json(
        { success: false, error: "Task instance not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: inst.toObject() });
  } catch (err) {
    console.error("PATCH /api/task-instances/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update task instance: ${message}` },
      { status: 500 },
    );
  }
}
