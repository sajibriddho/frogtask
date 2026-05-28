/**
 * GET /api/projects/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Cards with a due date in the requested window across boards the caller
 * can see. Same visibility logic as /api/projects/boards (explicit
 * member OR team OR public). Used by the calendar view.
 *
 * Optional filters: board_id, priority, member (user_id).
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardMember from "@/model/BoardMember";
import Card from "@/model/Card";

export async function GET(req: NextRequest) {
  const { error, session } = await requirePermission("projects.calendar");
  if (error) return error;

  try {
    await connectDB();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const filterBoard = url.searchParams.get("board_id");
    const filterPriority = url.searchParams.get("priority");
    const filterMember = url.searchParams.get("member");

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: "from and to query params are required" },
        { status: 400 },
      );
    }
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date range" },
        { status: 400 },
      );
    }

    // Boards the caller can see.
    const memberRows = await BoardMember.find({ user_id: session.user.id })
      .select("board_id")
      .lean<Array<{ board_id: string }>>();
    const memberBoardIds = memberRows.map((r) => r.board_id);

    const boards = await Board.find({
      status: "active",
      $or: [
        { _id: { $in: memberBoardIds } },
        { visibility: "team" },
        { visibility: "public" },
      ],
    })
      .select("_id title background")
      .lean<Array<{ _id: unknown; title: string; background: string }>>();
    const boardMap = new Map<
      string,
      { title: string; background: string }
    >();
    for (const b of boards) {
      boardMap.set(String(b._id), { title: b.title, background: b.background });
    }

    const cardFilter: Record<string, unknown> = {
      board_id: { $in: Array.from(boardMap.keys()) },
      is_archived: false,
      due_date: { $gte: fromDate, $lte: toDate },
    };
    if (filterBoard) cardFilter.board_id = filterBoard;
    if (filterPriority) cardFilter.priority = filterPriority;
    if (filterMember) cardFilter["members.user_id"] = filterMember;

    const cards = await Card.find(cardFilter)
      .sort({ due_date: 1, priority: -1 })
      .limit(800)
      .lean<Array<{ _id: unknown; board_id: string; [k: string]: unknown }>>();

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
    console.error("GET calendar", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch calendar: ${message}` },
      { status: 500 },
    );
  }
}
