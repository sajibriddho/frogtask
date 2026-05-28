/**
 * GET /api/projects/my-tasks
 *
 * All cards assigned to the caller, regardless of board. Server-side
 * filtering keeps the response small for users with hundreds of tasks
 * across many boards.
 *
 * Query string:
 *   filter=today|upcoming|overdue|completed|all  (default: all)
 *   board_id=<id>                                 limit to one board
 *   priority=low|medium|high|urgent
 *   label=<label_id>
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import Board from "@/model/Board";

export async function GET(req: NextRequest) {
  const { error, session } = await requirePermission("projects.my_tasks");
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? "all";
    const boardId = url.searchParams.get("board_id");
    const priority = url.searchParams.get("priority");
    const label = url.searchParams.get("label");

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const query: Record<string, unknown> = {
      "members.user_id": session.user.id,
      is_archived: false,
    };
    if (boardId) query.board_id = boardId;
    if (priority) query.priority = priority;
    if (label) query["labels.label_id"] = label;

    if (filter === "today") {
      query.due_date = { $gte: startOfToday, $lte: endOfToday };
      query.completed_at = null;
    } else if (filter === "upcoming") {
      query.due_date = { $gt: endOfToday };
      query.completed_at = null;
    } else if (filter === "overdue") {
      query.due_date = { $lt: startOfToday };
      query.completed_at = null;
    } else if (filter === "completed") {
      query.completed_at = { $ne: null };
    }

    const cards = await Card.find(query)
      .sort({ due_date: 1, position: 1 })
      .limit(500)
      .lean<Array<{ _id: unknown; board_id: string; [k: string]: unknown }>>();

    // Hydrate with board titles for the UI grouping.
    const boardIds = Array.from(new Set(cards.map((c) => c.board_id)));
    const boards = await Board.find({ _id: { $in: boardIds } })
      .select("_id title background")
      .lean<Array<{ _id: unknown; title: string; background: string }>>();
    const boardMap = new Map<
      string,
      { title: string; background: string }
    >();
    for (const b of boards) {
      boardMap.set(String(b._id), { title: b.title, background: b.background });
    }

    return NextResponse.json({
      success: true,
      data: cards.map((c) => ({
        ...c,
        id: String(c._id),
        board_title: boardMap.get(c.board_id)?.title ?? "Untitled board",
        board_background: boardMap.get(c.board_id)?.background ?? "emerald",
      })),
    });
  } catch (err) {
    console.error("GET my-tasks", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch my tasks: ${message}` },
      { status: 500 },
    );
  }
}
