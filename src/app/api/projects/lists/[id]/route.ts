/**
 * Single-list routes.
 *
 * PUT    /api/projects/lists/:id    Rename / archive a list.
 * DELETE /api/projects/lists/:id    Archive (soft).  All cards on the
 *                                    list are also archived.
 *
 * Member-or-higher role required for both.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BoardList from "@/model/BoardList";
import Card from "@/model/Card";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const list = await BoardList.findById(id).lean<{
      board_id: string;
      title: string;
    } | null>();
    if (!list) {
      return NextResponse.json(
        { success: false, error: "List not found" },
        { status: 404 },
      );
    }

    const guard = await requireBoardRole(
      list.board_id,
      session.user.id,
      "member",
    );
    if (guard.error) return guard.error;

    const body = (await req.json()) as Partial<{
      title: string;
      is_archived: boolean;
    }>;

    const update: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      update.title = body.title.trim();
    }
    if (typeof body.is_archived === "boolean") {
      update.is_archived = body.is_archived;
    }

    const updated = await BoardList.findByIdAndUpdate(id, update, {
      returnDocument: "after",
      runValidators: true,
    });

    if (update.is_archived === true) {
      await Card.updateMany({ list_id: id }, { is_archived: true });
    }

    recordActivity({
      board_id: list.board_id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      action:
        update.is_archived === true
          ? ACTIVITY_ACTIONS.LIST_ARCHIVED
          : ACTIVITY_ACTIONS.LIST_UPDATED,
      description:
        update.is_archived === true
          ? `${session.user.name ?? "Someone"} archived the list “${list.title}”`
          : `${session.user.name ?? "Someone"} renamed the list to “${
              update.title ?? list.title
            }”`,
    });

    return NextResponse.json({
      success: true,
      data: updated ? { ...updated.toObject(), id: String(updated._id) } : null,
    });
  } catch (err) {
    console.error("PUT list", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update list: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const list = await BoardList.findById(id).lean<{
      board_id: string;
      title: string;
    } | null>();
    if (!list) {
      return NextResponse.json(
        { success: false, error: "List not found" },
        { status: 404 },
      );
    }

    const guard = await requireBoardRole(
      list.board_id,
      session.user.id,
      "admin",
    );
    if (guard.error) return guard.error;

    await BoardList.findByIdAndUpdate(id, { is_archived: true });
    await Card.updateMany({ list_id: id }, { is_archived: true });

    recordActivity({
      board_id: list.board_id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      action: ACTIVITY_ACTIONS.LIST_ARCHIVED,
      description: `${session.user.name ?? "Someone"} archived the list “${list.title}”`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE list", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to archive list: ${message}` },
      { status: 500 },
    );
  }
}
