/**
 * Single-label routes.
 *
 * PUT /api/projects/labels/:id     Rename / recolor.
 * DELETE /api/projects/labels/:id  Delete and detach from every card.
 *
 * On rename/recolor we also patch the denormalised `labels` array on
 * every Card that references this label, so the board view stays in
 * sync without an extra query.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BoardLabel from "@/model/BoardLabel";
import Card from "@/model/Card";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const label = await BoardLabel.findById(id);
    if (!label) {
      return NextResponse.json(
        { success: false, error: "Label not found" },
        { status: 404 },
      );
    }
    const guard = await requireBoardRole(
      label.board_id,
      session.user.id,
      "member",
    );
    if (guard.error) return guard.error;

    const body = (await req.json()) as { name?: string; color?: string };
    if (typeof body.name === "string" && body.name.trim()) {
      label.name = body.name.trim();
    }
    if (typeof body.color === "string" && body.color.trim()) {
      label.color = body.color.trim();
    }
    await label.save();

    // Patch denormalised label refs on cards.
    await Card.updateMany(
      { board_id: label.board_id, "labels.label_id": id },
      {
        $set: {
          "labels.$[lbl].name": label.name,
          "labels.$[lbl].color": label.color,
        },
      },
      { arrayFilters: [{ "lbl.label_id": id }] },
    );

    return NextResponse.json({
      success: true,
      data: { ...label.toObject(), id: String(label._id) },
    });
  } catch (err) {
    console.error("PUT label", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update label: ${message}` },
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
    const label = await BoardLabel.findById(id);
    if (!label) {
      return NextResponse.json(
        { success: false, error: "Label not found" },
        { status: 404 },
      );
    }
    const guard = await requireBoardRole(
      label.board_id,
      session.user.id,
      "admin",
    );
    if (guard.error) return guard.error;

    await BoardLabel.deleteOne({ _id: id });
    await Card.updateMany(
      { board_id: label.board_id, "labels.label_id": id },
      { $pull: { labels: { label_id: id } } },
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE label", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete label: ${message}` },
      { status: 500 },
    );
  }
}
