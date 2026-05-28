/**
 * DELETE /api/projects/attachments/:id   Remove an attachment.
 * Uploader or board admin can delete.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import CardAttachment from "@/model/CardAttachment";
import { getBoardAccess } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const att = await CardAttachment.findById(id).lean<{
      _id: unknown;
      board_id: string;
      card_id: string;
      uploaded_by: { id: string };
    } | null>();
    if (!att) {
      return NextResponse.json(
        { success: false, error: "Attachment not found" },
        { status: 404 },
      );
    }
    let allowed = att.uploaded_by.id === session.user.id;
    if (!allowed) {
      const access = await getBoardAccess(att.board_id, session.user.id);
      allowed = !!access && (access.role === "owner" || access.role === "admin");
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own uploads" },
        { status: 403 },
      );
    }

    await CardAttachment.deleteOne({ _id: id });
    await Card.findByIdAndUpdate(att.card_id, {
      $inc: { attachment_count: -1 },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE attachment", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete attachment: ${message}` },
      { status: 500 },
    );
  }
}
