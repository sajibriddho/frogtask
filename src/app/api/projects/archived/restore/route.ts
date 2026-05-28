/**
 * POST /api/projects/archived/restore
 *
 * Body: { type: "board" | "list" | "card", id: string }
 * Flips the archived flag back. Member-or-higher role required.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardList from "@/model/BoardList";
import Card from "@/model/Card";
import { requireBoardRole } from "@/lib/board-acl";

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("projects.archived");
  if (error) return error;

  try {
    await connectDB();
    const body = (await req.json()) as {
      type?: "board" | "list" | "card";
      id?: string;
    };
    if (!body.type || !body.id) {
      return NextResponse.json(
        { success: false, error: "type and id are required" },
        { status: 400 },
      );
    }

    if (body.type === "board") {
      const board = await Board.findById(body.id);
      if (!board) {
        return NextResponse.json(
          { success: false, error: "Board not found" },
          { status: 404 },
        );
      }
      const guard = await requireBoardRole(
        String(board._id),
        session.user.id,
        "admin",
      );
      if (guard.error) return guard.error;
      board.status = "active";
      await board.save();
      return NextResponse.json({ success: true });
    }

    if (body.type === "list") {
      const list = await BoardList.findById(body.id);
      if (!list) {
        return NextResponse.json(
          { success: false, error: "List not found" },
          { status: 404 },
        );
      }
      const guard = await requireBoardRole(
        list.board_id,
        session.user.id,
        "member",
      );
      if (guard.error) return guard.error;
      list.is_archived = false;
      await list.save();
      return NextResponse.json({ success: true });
    }

    if (body.type === "card") {
      const card = await Card.findById(body.id);
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
      card.is_archived = false;
      await card.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown type" },
      { status: 400 },
    );
  } catch (err) {
    console.error("POST restore", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to restore: ${message}` },
      { status: 500 },
    );
  }
}
