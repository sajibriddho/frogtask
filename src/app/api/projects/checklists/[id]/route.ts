/**
 * Single-checklist routes.
 *
 * PUT    /api/projects/checklists/:id   Rename.
 * DELETE /api/projects/checklists/:id   Remove the checklist (and its items).
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

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const body = (await req.json()) as { title?: string };
    if (typeof body.title === "string" && body.title.trim()) {
      checklist.title = body.title.trim();
    }
    await checklist.save();
    return NextResponse.json({
      success: true,
      data: { ...checklist.toObject(), id: String(checklist._id) },
    });
  } catch (err) {
    console.error("PUT checklist", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update checklist: ${message}` },
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

    await Checklist.deleteOne({ _id: id });
    await refreshChecklistCounts(checklist.card_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE checklist", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete checklist: ${message}` },
      { status: 500 },
    );
  }
}
