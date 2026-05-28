/**
 * Boards API — collection routes.
 *
 * GET  /api/projects/boards        List boards visible to the caller.
 * POST /api/projects/boards        Create a board (caller becomes the
 *                                   "owner" via a BoardMember row, and
 *                                   the five default lists are seeded).
 *
 * Visibility filter:
 *   • The caller always sees boards they explicitly belong to.
 *   • They additionally see "team" / "public" boards regardless of
 *     membership (mirrors getBoardAccess() — see lib/board-acl.ts).
 *
 * Query string:
 *   q=...                  title contains, case-insensitive
 *   filter=favorite|recent|archived|all   (default: all active)
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardMember from "@/model/BoardMember";
import BoardList from "@/model/BoardList";
import Card from "@/model/Card";
import { recordActivity, slugify } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS, DEFAULT_LISTS } from "@/types/project";

interface RawBoard {
  _id: unknown;
  title: string;
  slug: string;
  description: string;
  visibility: "private" | "team" | "public";
  background: string;
  is_favorite: boolean;
  status: "active" | "archived";
  created_by: { id: string; name: string };
  updated_by: { id: string; name: string };
  createdAt?: Date;
  updatedAt?: Date;
}

// ──────────────────────────────────────────────────────────────────────
// GET
// ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const filter = (searchParams.get("filter") ?? "all").trim();

    // Boards the caller is an explicit member of.
    const memberRows = await BoardMember.find({ user_id: session.user.id })
      .select("board_id role")
      .lean<Array<{ board_id: string; role: string }>>();
    const memberBoardIds = memberRows.map((r) => r.board_id);
    const roleByBoard = new Map(memberRows.map((r) => [r.board_id, r.role]));

    // Visible = explicit member OR team OR public.
    const visibility: Array<Record<string, unknown>> = [
      { _id: { $in: memberBoardIds } },
      { visibility: "team" },
      { visibility: "public" },
    ];

    const baseFilter: Record<string, unknown> = { $or: visibility };
    if (q) baseFilter.title = { $regex: q, $options: "i" };

    // Status: archived boards are *only* visible under the Archived
    // chip. All other chips ("all", "favorite", "recent") are scoped
    // to active boards — archived ones live in the dedicated tab so
    // the default grid stays focused on what's currently in flight.
    if (filter === "archived") {
      baseFilter.status = "archived";
    } else {
      baseFilter.status = "active";
    }
    if (filter === "favorite") baseFilter.is_favorite = true;

    const sort: Record<string, 1 | -1> =
      filter === "recent" ? { updatedAt: -1 } : { is_favorite: -1, updatedAt: -1 };

    const boards = await Board.find(baseFilter)
      .sort(sort)
      .limit(200)
      .lean<RawBoard[]>();

    const boardIds = boards.map((b) => String(b._id));

    // Per-board counters (keep this cheap — three indexed counts).
    const [listCounts, cardCounts, memberCounts] = await Promise.all([
      BoardList.aggregate([
        { $match: { board_id: { $in: boardIds }, is_archived: false } },
        { $group: { _id: "$board_id", count: { $sum: 1 } } },
      ]),
      Card.aggregate([
        { $match: { board_id: { $in: boardIds }, is_archived: false } },
        { $group: { _id: "$board_id", count: { $sum: 1 } } },
      ]),
      BoardMember.aggregate([
        { $match: { board_id: { $in: boardIds } } },
        { $group: { _id: "$board_id", count: { $sum: 1 } } },
      ]),
    ]);

    const lookupCount = (rows: Array<{ _id: string; count: number }>) => {
      const map = new Map<string, number>();
      for (const r of rows) map.set(r._id, r.count);
      return map;
    };
    const listCount = lookupCount(listCounts as Array<{ _id: string; count: number }>);
    const cardCount = lookupCount(cardCounts as Array<{ _id: string; count: number }>);
    const memberCount = lookupCount(memberCounts as Array<{ _id: string; count: number }>);

    const data = boards.map((b) => {
      const id = String(b._id);
      let myRole = roleByBoard.get(id) ?? null;
      if (!myRole) {
        if (b.visibility === "public") myRole = "viewer";
        else if (b.visibility === "team") myRole = "member";
      }
      return {
        ...b,
        id,
        list_count: listCount.get(id) ?? 0,
        card_count: cardCount.get(id) ?? 0,
        member_count: memberCount.get(id) ?? 0,
        my_role: myRole,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/projects/boards", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch boards: ${message}` },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// POST
// ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("projects.boards.create");
  if (error) return error;

  try {
    await connectDB();
    const body = (await req.json()) as Partial<{
      title: string;
      description: string;
      visibility: "private" | "team" | "public";
      background: string;
      is_favorite: boolean;
    }>;

    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: "Board title is required" },
        { status: 400 },
      );
    }

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const board = await Board.create({
      title,
      slug: slugify(title),
      description: (body.description ?? "").slice(0, 4000),
      visibility: body.visibility ?? "team",
      background: body.background ?? "emerald",
      is_favorite: !!body.is_favorite,
      status: "active",
      created_by: actor,
      updated_by: actor,
    });

    // Owner row + default lists.
    await BoardMember.create({
      board_id: String(board._id),
      user_id: actor.id,
      user_name: actor.name,
      user_email: session.user.email ?? "",
      role: "owner",
    });

    await BoardList.insertMany(
      DEFAULT_LISTS.map((name, idx) => ({
        board_id: String(board._id),
        title: name,
        position: (idx + 1) * 1024,
        is_archived: false,
      })),
    );

    recordActivity({
      board_id: String(board._id),
      user_id: actor.id,
      user_name: actor.name,
      action: ACTIVITY_ACTIONS.BOARD_CREATED,
      description: `${actor.name} created the board “${title}”`,
    });

    return NextResponse.json(
      { success: true, data: { ...board.toObject(), id: String(board._id) } },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/projects/boards", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create board: ${message}` },
      { status: 500 },
    );
  }
}
