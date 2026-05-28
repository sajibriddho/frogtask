/**
 * Single comment routes — author-only edit/delete.
 *
 * PUT    /api/projects/comments/:id   Edit body (author only).
 * DELETE /api/projects/comments/:id   Delete (author or board admin).
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import CardComment from "@/model/CardComment";
import { getBoardAccess } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const comment = await CardComment.findById(id);
    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }
    if (comment.user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Only the author can edit a comment" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as { body?: string };
    const text = (body.body ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { success: false, error: "Comment cannot be empty" },
        { status: 400 },
      );
    }

    comment.body = text;
    await comment.save();
    return NextResponse.json({
      success: true,
      data: { ...comment.toObject(), id: String(comment._id) },
    });
  } catch (err) {
    console.error("PUT comment", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update comment: ${message}` },
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
    const comment = await CardComment.findById(id).lean<{
      _id: unknown;
      board_id: string;
      card_id: string;
      user_id: string;
    } | null>();
    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    let allowed = comment.user_id === session.user.id;
    if (!allowed) {
      const access = await getBoardAccess(comment.board_id, session.user.id);
      allowed = !!access && (access.role === "owner" || access.role === "admin");
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own comments" },
        { status: 403 },
      );
    }

    await CardComment.deleteOne({ _id: id });
    await Card.findByIdAndUpdate(comment.card_id, {
      $inc: { comment_count: -1 },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE comment", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete comment: ${message}` },
      { status: 500 },
    );
  }
}
