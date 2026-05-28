/**
 * PATCH /api/projects/boards/:id/favorite
 *
 * Toggle the calling user's favorite flag on a board. We deliberately
 * don't gate this behind the `projects.boards.update` action permission
 * because favouriting is a *personal* preference — any viewer can mark
 * a board they have access to. (We still call requireBoardRole("viewer")
 * so private boards stay protected.)
 *
 * NOTE on the data model: the spec describes `is_favorite` as a board
 * field, so favouriting is currently a board-level flag rather than a
 * per-user pin. This keeps the implementation simple while matching the
 * spec; if multi-user favourites are needed later, swap to a
 * `BoardFavorite { board_id, user_id }` collection.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "viewer");
    if (guard.error) return guard.error;

    const body = (await req.json()) as { is_favorite?: boolean };
    const next = !!body.is_favorite;

    const board = await Board.findByIdAndUpdate(
      id,
      { is_favorite: next },
      { returnDocument: "after" },
    );
    if (!board) {
      return NextResponse.json(
        { success: false, error: "Board not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: String(board._id), is_favorite: board.is_favorite },
    });
  } catch (err) {
    console.error("PATCH favorite", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update favorite: ${message}` },
      { status: 500 },
    );
  }
}
