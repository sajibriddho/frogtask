/**
 * POST /api/projects/checklists/:id/items   Append an item.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import Checklist from "@/model/Checklist";
import { requireBoardRole } from "@/lib/board-acl";
import { refreshChecklistCounts } from "@/lib/checklist-helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
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

    const body = (await req.json()) as {
      text?: string;
      assigned_to?: string | null;
      due_date?: string | null;
    };
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { success: false, error: "Item text is required" },
        { status: 400 },
      );
    }

    const lastPos = checklist.items.length
      ? Math.max(
          ...checklist.items.map((i: { position: number }) => i.position),
        )
      : 0;
    checklist.items.push({
      text,
      is_completed: false,
      assigned_to: body.assigned_to ?? null,
      due_date: body.due_date ? new Date(body.due_date) : null,
      position: lastPos + 1024,
    });
    await checklist.save();
    await refreshChecklistCounts(checklist.card_id);

    const item = checklist.items[checklist.items.length - 1];
    return NextResponse.json(
      {
        success: true,
        data: {
          ...item,
          id: String(item._id),
          checklist_id: String(checklist._id),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST checklist item", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to add item: ${message}` },
      { status: 500 },
    );
  }
}
