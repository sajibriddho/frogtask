/**
 * Comments collection — POST a comment to a card.
 * Listing is folded into GET /api/projects/cards/:id.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import CardComment from "@/model/CardComment";
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

    const body = (await req.json()) as { body?: string };
    const text = (body.body ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { success: false, error: "Comment cannot be empty" },
        { status: 400 },
      );
    }

    const comment = await CardComment.create({
      card_id: id,
      board_id: card.board_id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      body: text,
    });

    await Card.findByIdAndUpdate(id, { $inc: { comment_count: 1 } });

    recordActivity({
      board_id: card.board_id,
      card_id: id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Someone",
      action: ACTIVITY_ACTIONS.COMMENT_ADDED,
      description: `${session.user.name ?? "Someone"} commented on “${card.title}”`,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...comment.toObject(), id: String(comment._id) },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST comment", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to add comment: ${message}` },
      { status: 500 },
    );
  }
}
