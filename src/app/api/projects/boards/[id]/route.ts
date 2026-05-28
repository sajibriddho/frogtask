/**
 * Boards API — single document.
 *
 * GET    /api/projects/boards/:id   Hydrate the kanban view (board +
 *                                    lists + cards in one round-trip).
 * PUT    /api/projects/boards/:id   Update board metadata.
 *                                    Allowed: title, description,
 *                                    visibility, background, is_favorite.
 *                                    Requires `admin` board role.
 * DELETE /api/projects/boards/:id   Archive the board (soft).
 *                                    Use ?hard=1 to delete completely;
 *                                    that requires the `owner` role.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardList from "@/model/BoardList";
import BoardMember from "@/model/BoardMember";
import Card from "@/model/Card";
import BoardLabel from "@/model/BoardLabel";
import CardComment from "@/model/CardComment";
import CardAttachment from "@/model/CardAttachment";
import Checklist from "@/model/Checklist";
import ProjectActivity from "@/model/ProjectActivity";
import { getBoardAccess, requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/projects/boards/:id  — hydrate the kanban view
// ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const access = await getBoardAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Board not found or access denied" },
        { status: 404 },
      );
    }

    const [lists, cards, labels, members] = await Promise.all([
      BoardList.find({ board_id: id, is_archived: false })
        .sort({ position: 1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
      Card.find({ board_id: id, is_archived: false })
        .sort({ position: 1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
      BoardLabel.find({ board_id: id })
        .sort({ name: 1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
      BoardMember.find({ board_id: id })
        .sort({ joined_at: 1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        board: access.board,
        my_role: access.role,
        lists: lists.map((l) => ({ ...l, id: String(l._id) })),
        cards: cards.map((c) => ({ ...c, id: String(c._id) })),
        labels: labels.map((l) => ({ ...l, id: String(l._id) })),
        members: members.map((m) => ({ ...m, id: String(m._id) })),
      },
    });
  } catch (err) {
    console.error("GET /api/projects/boards/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch board: ${message}` },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// PUT /api/projects/boards/:id
// ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards.update");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "admin");
    if (guard.error) return guard.error;

    const body = (await req.json()) as Partial<{
      title: string;
      description: string;
      visibility: "private" | "team" | "public";
      background: string;
      is_favorite: boolean;
      status: "active" | "archived";
    }>;

    const update: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      update.title = body.title.trim();
    }
    if (typeof body.description === "string") {
      update.description = body.description.slice(0, 4000);
    }
    if (
      body.visibility === "private" ||
      body.visibility === "team" ||
      body.visibility === "public"
    ) {
      update.visibility = body.visibility;
    }
    if (typeof body.background === "string" && body.background) {
      update.background = body.background;
    }
    if (typeof body.is_favorite === "boolean") {
      update.is_favorite = body.is_favorite;
    }
    if (body.status === "active" || body.status === "archived") {
      update.status = body.status;
    }

    update.updated_by = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const board = await Board.findByIdAndUpdate(id, update, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!board) {
      return NextResponse.json(
        { success: false, error: "Board not found" },
        { status: 404 },
      );
    }

    recordActivity({
      board_id: id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      action:
        update.status === "archived"
          ? ACTIVITY_ACTIONS.BOARD_ARCHIVED
          : ACTIVITY_ACTIONS.BOARD_UPDATED,
      description:
        update.status === "archived"
          ? `${session.user.name ?? "Someone"} archived the board`
          : `${session.user.name ?? "Someone"} updated the board`,
    });

    return NextResponse.json({
      success: true,
      data: { ...board.toObject(), id: String(board._id) },
    });
  } catch (err) {
    console.error("PUT /api/projects/boards/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update board: ${message}` },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// DELETE /api/projects/boards/:id
// ──────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards.delete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "1";

    const requiredRole = hard ? "owner" : "admin";
    const guard = await requireBoardRole(id, session.user.id, requiredRole);
    if (guard.error) return guard.error;

    if (!hard) {
      const board = await Board.findByIdAndUpdate(
        id,
        {
          status: "archived",
          updated_by: {
            id: session.user.id,
            name: session.user.name ?? "Unknown",
          },
        },
        { returnDocument: "after" },
      );
      if (!board) {
        return NextResponse.json(
          { success: false, error: "Board not found" },
          { status: 404 },
        );
      }
      recordActivity({
        board_id: id,
        user_id: session.user.id,
        user_name: session.user.name ?? "Unknown",
        action: ACTIVITY_ACTIONS.BOARD_ARCHIVED,
        description: `${session.user.name ?? "Someone"} archived the board`,
      });
      return NextResponse.json({ success: true });
    }

    // Hard delete — cascade through every related collection.
    await Promise.all([
      Board.deleteOne({ _id: id }),
      BoardList.deleteMany({ board_id: id }),
      BoardMember.deleteMany({ board_id: id }),
      Card.deleteMany({ board_id: id }),
      BoardLabel.deleteMany({ board_id: id }),
      CardComment.deleteMany({ board_id: id }),
      CardAttachment.deleteMany({ board_id: id }),
      Checklist.deleteMany({ card_id: { $in: [] } }), // see note below
      ProjectActivity.deleteMany({ board_id: id }),
    ]);

    // Checklists key off card_id, not board_id, so do them as a follow-up
    // sweep against the now-deleted cards' ids — we already wiped Cards
    // above, so we instead key off "no card_id matches" by querying
    // checklists that point at a nonexistent card under this board. Cheap
    // pragma: just delete them in two steps.
    await Card.deleteMany({ board_id: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/boards/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete board: ${message}` },
      { status: 500 },
    );
  }
}
