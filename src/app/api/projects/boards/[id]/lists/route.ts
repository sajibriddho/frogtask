/**
 * Board lists API.
 *
 * GET  /api/projects/boards/:id/lists      All non-archived lists.
 * POST /api/projects/boards/:id/lists      Append a new list.
 *                                            Requires `member` role.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BoardList from "@/model/BoardList";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

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

    const lists = await BoardList.find({ board_id: id, is_archived: false })
      .sort({ position: 1 })
      .lean<Array<{ _id: unknown; [k: string]: unknown }>>();

    return NextResponse.json({
      success: true,
      data: lists.map((l) => ({ ...l, id: String(l._id) })),
    });
  } catch (err) {
    console.error("GET lists", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch lists: ${message}` },
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

    const body = (await req.json()) as { title?: string };
    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: "List title is required" },
        { status: 400 },
      );
    }

    // New lists drop in at the end.
    const last = await BoardList.findOne({ board_id: id, is_archived: false })
      .sort({ position: -1 })
      .lean<{ position: number } | null>();
    const position = (last?.position ?? 0) + 1024;

    const list = await BoardList.create({
      board_id: id,
      title,
      position,
      is_archived: false,
    });

    recordActivity({
      board_id: id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Unknown",
      action: ACTIVITY_ACTIONS.LIST_CREATED,
      description: `${session.user.name ?? "Someone"} created the list “${title}”`,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...list.toObject(), id: String(list._id) },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST lists", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create list: ${message}` },
      { status: 500 },
    );
  }
}
