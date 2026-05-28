/**
 * Board labels API.
 *
 * GET  /api/projects/boards/:id/labels   List labels.
 * POST /api/projects/boards/:id/labels   Create a label.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BoardLabel from "@/model/BoardLabel";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "viewer");
    if (guard.error) return guard.error;

    const labels = await BoardLabel.find({ board_id: id })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; [k: string]: unknown }>>();

    return NextResponse.json({
      success: true,
      data: labels.map((l) => ({ ...l, id: String(l._id) })),
    });
  } catch (err) {
    console.error("GET labels", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch labels: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "member");
    if (guard.error) return guard.error;

    const body = (await req.json()) as { name?: string; color?: string };
    const name = (body.name ?? "").trim();
    const color = (body.color ?? "").trim();
    if (!name || !color) {
      return NextResponse.json(
        { success: false, error: "Label name and color are required" },
        { status: 400 },
      );
    }

    const label = await BoardLabel.create({
      board_id: id,
      name,
      color,
    });
    return NextResponse.json(
      { success: true, data: { ...label.toObject(), id: String(label._id) } },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST label", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create label: ${message}` },
      { status: 500 },
    );
  }
}
