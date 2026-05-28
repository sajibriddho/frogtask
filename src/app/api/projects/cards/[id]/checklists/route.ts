/**
 * POST /api/projects/cards/:id/checklists   Add a new checklist to card.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import Checklist from "@/model/Checklist";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const card = await Card.findById(id);
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

    const body = (await req.json()) as { title?: string };
    const title = (body.title ?? "").trim() || "Checklist";

    const last = await Checklist.findOne({ card_id: id })
      .sort({ position: -1 })
      .lean<{ position: number } | null>();
    const position = (last?.position ?? 0) + 1024;

    const checklist = await Checklist.create({
      card_id: id,
      title,
      position,
      items: [],
    });

    recordActivity({
      board_id: card.board_id,
      card_id: id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Someone",
      action: ACTIVITY_ACTIONS.CHECKLIST_ADDED,
      description: `${session.user.name ?? "Someone"} added checklist “${title}”`,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...checklist.toObject(),
          id: String(checklist._id),
          items: [],
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST checklist", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to add checklist: ${message}` },
      { status: 500 },
    );
  }
}
