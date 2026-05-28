/**
 * Tasks API — single document routes (per-user; users own their own tasks).
 * GET    /api/tasks/:id   View a task rule the caller owns.
 * PUT    /api/tasks/:id   Update a task rule the caller owns.
 * DELETE /api/tasks/:id   Soft-delete (sets deleted_at = now).
 *
 * Every operation enforces `assigned_to === session.user.id` so users
 * can never read or modify another user's tasks.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Task from "@/model/Task";
import { validateTaskPayload } from "@/lib/task-payload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/tasks/:id
// ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("tasks.all");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const task = await Task.findOne({
      _id: id,
      assigned_to: session.user.id,
    }).lean<{ _id: unknown } | null>();

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...task, id: String(task._id) },
    });
  } catch (err) {
    console.error("GET /api/tasks/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch task: ${message}` },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /api/tasks/:id
// ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("tasks.all.update");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const result = validateTaskPayload(body);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const task = await Task.findOneAndUpdate(
      { _id: id, assigned_to: session.user.id },
      { ...result.data, updated_by: actor },
      { returnDocument: "after", runValidators: true },
    );

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: task.toObject() });
  } catch (err) {
    console.error("PUT /api/tasks/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update task: ${message}` },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// DELETE /api/tasks/:id  (soft-delete)
// ──────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("tasks.all.delete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const task = await Task.findOneAndUpdate(
      { _id: id, assigned_to: session.user.id },
      { deleted_at: new Date(), updated_by: actor, status: "Inactive" },
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
    console.error("DELETE /api/tasks/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete task: ${message}` },
      { status: 500 },
    );
  }
}
