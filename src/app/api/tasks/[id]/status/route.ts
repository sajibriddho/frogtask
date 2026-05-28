/**
 * Toggle a task's Active / Inactive status.
 * PATCH /api/tasks/:id/status   { status: "Active" | "Inactive" }
 *
 * Kept as its own route so the All Tasks list can flip a row without
 * sending the entire (re-validated) payload through PUT /api/tasks/:id.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Task from "@/model/Task";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("tasks.all.toggle");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const status = body?.status;
    if (status !== "Active" && status !== "Inactive") {
      return NextResponse.json(
        { success: false, error: "status must be 'Active' or 'Inactive'" },
        { status: 400 },
      );
    }

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const task = await Task.findOneAndUpdate(
      { _id: id, assigned_to: session.user.id },
      { status, updated_by: actor },
      { returnDocument: "after" },
    );

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: task.toObject() });
  } catch (err) {
    console.error("PATCH /api/tasks/:id/status", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update status: ${message}` },
      { status: 500 },
    );
  }
}
