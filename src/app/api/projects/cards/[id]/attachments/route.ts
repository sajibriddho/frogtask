/**
 * POST /api/projects/cards/:id/attachments   Attach a file/link to a card.
 *
 * The request body simply records the metadata; the actual upload pipe
 * is the existing /api/uploads endpoint. Pasting a link works the same
 * way — the client supplies file_url + file_name.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import CardAttachment from "@/model/CardAttachment";
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

    const body = (await req.json()) as Partial<{
      file_name: string;
      file_url: string;
      file_type: string;
      file_size: number;
    }>;

    const file_name = (body.file_name ?? "").trim();
    const file_url = (body.file_url ?? "").trim();
    if (!file_name || !file_url) {
      return NextResponse.json(
        { success: false, error: "file_name and file_url are required" },
        { status: 400 },
      );
    }

    const attachment = await CardAttachment.create({
      card_id: id,
      board_id: card.board_id,
      file_name,
      file_url,
      file_type: body.file_type ?? "",
      file_size: typeof body.file_size === "number" ? body.file_size : 0,
      uploaded_by: {
        id: session.user.id,
        name: session.user.name ?? "Unknown",
      },
    });
    await Card.findByIdAndUpdate(id, { $inc: { attachment_count: 1 } });

    recordActivity({
      board_id: card.board_id,
      card_id: id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Someone",
      action: ACTIVITY_ACTIONS.ATTACHMENT_UPLOADED,
      description: `${session.user.name ?? "Someone"} attached “${file_name}”`,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...attachment.toObject(), id: String(attachment._id) },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST attachment", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to attach: ${message}` },
      { status: 500 },
    );
  }
}
