/**
 * Per-item routes within a checklist.
 *
 * PATCH  /api/projects/checklists/:id/items/:itemId   Toggle / rename / set
 *                                                     assignee / due date.
 * DELETE /api/projects/checklists/:id/items/:itemId   Remove item.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import Checklist from "@/model/Checklist";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";
import { refreshChecklistCounts } from "@/lib/checklist-helpers";

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id, itemId } = await params;
    const checklist = await Checklist.findById(id);
    if (!checklist) {
      return NextResponse.json(
        { success: false, error: "Checklist not found" },
        { status: 404 },
      );
    }
    const card = await Card.findById(checklist.card_id);
    if (!card) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    const guard = await requireBoardRole(
      card.board_id,
      session.user.id,
      "member",
    );
    if (guard.error) return guard.error;

    const item = checklist.items.id(new mongoose.Types.ObjectId(itemId));
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 },
      );
    }

    const body = (await req.json()) as Partial<{
      text: string;
      is_completed: boolean;
      assigned_to: string | null;
      due_date: string | null;
    }>;

    if (typeof body.text === "string" && body.text.trim()) {
      item.text = body.text.trim();
    }
    if (typeof body.is_completed === "boolean") {
      const prev = item.is_completed;
      item.is_completed = body.is_completed;
      if (prev !== body.is_completed) {
        recordActivity({
          board_id: card.board_id,
          card_id: card._id.toString(),
          user_id: session.user.id,
          user_name: session.user.name ?? "Someone",
          action: ACTIVITY_ACTIONS.CHECKLIST_ITEM_TOGGLED,
          description: `${session.user.name ?? "Someone"} ${
            body.is_completed ? "completed" : "reopened"
          } “${item.text}”`,
        });
      }
    }
    if (body.assigned_to !== undefined) {
      item.assigned_to = body.assigned_to ?? null;
    }
    if (body.due_date !== undefined) {
      item.due_date = body.due_date ? new Date(body.due_date) : null;
    }

    await checklist.save();
    await refreshChecklistCounts(checklist.card_id);

    return NextResponse.json({
      success: true,
      data: { ...item.toObject(), id: String(item._id) },
    });
  } catch (err) {
    console.error("PATCH checklist item", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update item: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id, itemId } = await params;
    const checklist = await Checklist.findById(id);
    if (!checklist) {
      return NextResponse.json(
        { success: false, error: "Checklist not found" },
        { status: 404 },
      );
    }
    const card = await Card.findById(checklist.card_id);
    if (!card) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    const guard = await requireBoardRole(
      card.board_id,
      session.user.id,
      "member",
    );
    if (guard.error) return guard.error;

    const item = checklist.items.id(new mongoose.Types.ObjectId(itemId));
    if (item) item.deleteOne();
    await checklist.save();
    await refreshChecklistCounts(checklist.card_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE checklist item", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete item: ${message}` },
      { status: 500 },
    );
  }
}
