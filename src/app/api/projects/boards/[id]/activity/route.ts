/**
 * GET /api/projects/boards/:id/activity   Recent activity for a board.
 * GET ?card_id=...                         Or filter to a single card.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import ProjectActivity from "@/model/ProjectActivity";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "viewer");
    if (guard.error) return guard.error;

    const url = new URL(req.url);
    const cardId = url.searchParams.get("card_id");
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 1),
      100,
    );

    const filter: Record<string, unknown> = { board_id: id };
    if (cardId) filter.card_id = cardId;

    const rows = await ProjectActivity.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<Array<{ _id: unknown; [k: string]: unknown }>>();

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ ...r, id: String(r._id) })),
    });
  } catch (err) {
    console.error("GET activity", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch activity: ${message}` },
      { status: 500 },
    );
  }
}
