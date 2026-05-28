/**
 * GET /api/projects/stats
 *
 * Lightweight dashboard widget: total boards / active cards / completed
 * cards / overdue tasks visible to the caller. Used by the Boards page
 * header and a future homepage widget.
 */

import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardMember from "@/model/BoardMember";
import Card from "@/model/Card";

export async function GET() {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();

    const memberRows = await BoardMember.find({ user_id: session.user.id })
      .select("board_id")
      .lean<Array<{ board_id: string }>>();
    const memberBoardIds = memberRows.map((r) => r.board_id);

    const visibleBoards = await Board.find({
      $or: [
        { _id: { $in: memberBoardIds } },
        { visibility: "team" },
        { visibility: "public" },
      ],
    })
      .select("_id status")
      .lean<Array<{ _id: unknown; status: string }>>();
    const visibleBoardIds = visibleBoards.map((b) => String(b._id));
    const activeBoardIds = visibleBoards
      .filter((b) => b.status === "active")
      .map((b) => String(b._id));

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [active, completed, overdue, mine] = await Promise.all([
      Card.countDocuments({
        board_id: { $in: activeBoardIds },
        is_archived: false,
        completed_at: null,
      }),
      Card.countDocuments({
        board_id: { $in: visibleBoardIds },
        is_archived: false,
        completed_at: { $ne: null },
      }),
      Card.countDocuments({
        board_id: { $in: activeBoardIds },
        is_archived: false,
        completed_at: null,
        due_date: { $lt: startOfToday },
      }),
      Card.countDocuments({
        "members.user_id": session.user.id,
        is_archived: false,
        completed_at: null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        boards_total: activeBoardIds.length,
        boards_archived: visibleBoardIds.length - activeBoardIds.length,
        cards_active: active,
        cards_completed: completed,
        cards_overdue: overdue,
        my_open: mine,
      },
    });
  } catch (err) {
    console.error("GET stats", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch stats: ${message}` },
      { status: 500 },
    );
  }
}
