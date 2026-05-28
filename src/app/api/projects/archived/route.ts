/**
 * GET /api/projects/archived
 *
 * Returns archived boards, lists, and cards visible to the caller. Used
 * by the "Archived items" page so users can restore or hard-delete.
 */

import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardList from "@/model/BoardList";
import BoardMember from "@/model/BoardMember";
import Card from "@/model/Card";

export async function GET() {
  const { error, session } = await requirePermission("projects.archived");
  if (error) return error;

  try {
    await connectDB();
    const memberRows = await BoardMember.find({ user_id: session.user.id })
      .select("board_id role")
      .lean<Array<{ board_id: string; role: string }>>();
    const memberBoardIds = memberRows.map((r) => r.board_id);

    const visibleBoards = await Board.find({
      $or: [
        { _id: { $in: memberBoardIds } },
        { visibility: "team" },
        { visibility: "public" },
      ],
    })
      .select("_id title background status")
      .lean<
        Array<{
          _id: unknown;
          title: string;
          background: string;
          status: string;
        }>
      >();

    const boardIds = visibleBoards.map((b) => String(b._id));
    const boardMap = new Map<
      string,
      { id: string; title: string; background: string; status: string }
    >();
    for (const b of visibleBoards) {
      const id = String(b._id);
      boardMap.set(id, {
        id,
        title: b.title,
        background: b.background,
        status: b.status,
      });
    }

    const [archivedLists, archivedCards] = await Promise.all([
      BoardList.find({ board_id: { $in: boardIds }, is_archived: true })
        .sort({ updatedAt: -1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
      Card.find({ board_id: { $in: boardIds }, is_archived: true })
        .sort({ updatedAt: -1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        archived_boards: visibleBoards
          .filter((b) => b.status === "archived")
          .map((b) => ({ ...boardMap.get(String(b._id))! })),
        archived_lists: archivedLists.map((l) => ({
          ...l,
          id: String(l._id),
          board_title: boardMap.get(String(l.board_id as string))?.title ?? "—",
        })),
        archived_cards: archivedCards.map((c) => ({
          ...c,
          id: String(c._id),
          board_title: boardMap.get(String(c.board_id as string))?.title ?? "—",
        })),
      },
    });
  } catch (err) {
    console.error("GET archived", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch archived items: ${message}` },
      { status: 500 },
    );
  }
}
