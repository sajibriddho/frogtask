/**
 * Task tags — single-doc routes.
 *
 * PUT    /api/task-tags/:id    Rename / recolour a tag the caller owns.
 * DELETE /api/task-tags/:id    Delete a tag the caller owns. Detaches the
 *                              tag from every task that references it.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import TaskTag from "@/model/TaskTag";
import Task from "@/model/Task";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("tasks.all.update");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: "Tag name is required" },
          { status: 400 },
        );
      }
      if (name.length > 64) {
        return NextResponse.json(
          { success: false, error: "Tag name must be 64 characters or less" },
          { status: 400 },
        );
      }
      patch.name = name;
    }
    if (typeof body?.color === "string" && body.color.trim()) {
      patch.color = asString(body.color).trim();
    }

    try {
      const tag = await TaskTag.findOneAndUpdate(
        { _id: id, user_id: session.user.id },
        patch,
        { returnDocument: "after", runValidators: true },
      );
      if (!tag) {
        return NextResponse.json(
          { success: false, error: "Tag not found" },
          { status: 404 },
        );
      }
      const obj = tag.toObject() as { _id: unknown };
      return NextResponse.json({
        success: true,
        data: { ...obj, id: String(obj._id) },
      });
    } catch (updateErr) {
      if ((updateErr as { code?: number })?.code === 11000) {
        return NextResponse.json(
          { success: false, error: "A tag with that name already exists" },
          { status: 409 },
        );
      }
      throw updateErr;
    }
  } catch (err) {
    console.error("PUT /api/task-tags/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update tag: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("tasks.all.delete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const tag = await TaskTag.findOneAndDelete({
      _id: id,
      user_id: session.user.id,
    });
    if (!tag) {
      return NextResponse.json(
        { success: false, error: "Tag not found" },
        { status: 404 },
      );
    }

    // Detach this tag from every task that references it.
    await Task.updateMany(
      { assigned_to: session.user.id, tag_id: id },
      { $set: { tag_id: "" } },
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/task-tags/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete tag: ${message}` },
      { status: 500 },
    );
  }
}
