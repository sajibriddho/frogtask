/**
 * POST /api/projects/cards/:id/duplicate
 *
 * Clone a card (members + labels are copied, comments / attachments /
 * checklists are not). The clone lands directly below the original in
 * the same list.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const card = await Card.findById(id).lean<{
      _id: unknown;
      board_id: string;
      list_id: string;
      title: string;
      description: string;
      position: number;
      priority: string;
      cover: string;
      members: Array<{ user_id: string; user_name: string }>;
      labels: Array<{ label_id: string; name: string; color: string }>;
    } | null>();
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

    // Insert just after the original.
    const next = await Card.findOne({
      list_id: card.list_id,
      is_archived: false,
      position: { $gt: card.position },
    })
      .sort({ position: 1 })
      .lean<{ position: number } | null>();
    const newPos = next ? (card.position + next.position) / 2 : card.position + 1024;

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const created = await Card.create({
      board_id: card.board_id,
      list_id: card.list_id,
      title: `${card.title} (copy)`,
      description: card.description,
      position: newPos,
      priority: card.priority,
      start_date: null,
      due_date: null,
      completed_at: null,
      cover: card.cover,
      is_archived: false,
      members: card.members,
      labels: card.labels,
      created_by: actor,
      updated_by: actor,
    });

    recordActivity({
      board_id: card.board_id,
      card_id: String(created._id),
      user_id: actor.id,
      user_name: actor.name,
      action: ACTIVITY_ACTIONS.CARD_DUPLICATED,
      description: `${actor.name} duplicated “${card.title}”`,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...created.toObject(), id: String(created._id) },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("duplicate card", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to duplicate card: ${message}` },
      { status: 500 },
    );
  }
}
