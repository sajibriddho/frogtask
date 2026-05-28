/**
 * POST /api/projects/cards   Create a card.
 *
 * Body: { board_id, list_id, title, description?, priority?, start_date?,
 *         due_date?, cover?, members?, labels? }
 *
 * The new card is appended to the bottom of its target list. Member +
 * label fields are denormalised onto the document for fast reads.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import BoardList from "@/model/BoardList";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof VALID_PRIORITIES)[number];

function parseDate(input: unknown): Date | null {
  if (!input || typeof input !== "string") return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const body = (await req.json()) as Partial<{
      board_id: string;
      list_id: string;
      title: string;
      description: string;
      priority: Priority;
      start_date: string;
      due_date: string;
      cover: string;
      members: Array<{ user_id: string; user_name: string }>;
      labels: Array<{ label_id: string; name: string; color: string }>;
    }>;

    if (!body.board_id || !body.list_id) {
      return NextResponse.json(
        { success: false, error: "board_id and list_id are required" },
        { status: 400 },
      );
    }
    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: "Card title is required" },
        { status: 400 },
      );
    }

    const guard = await requireBoardRole(
      body.board_id,
      session.user.id,
      "member",
    );
    if (guard.error) return guard.error;

    // Sanity: the list must live on this board and not be archived.
    const list = await BoardList.findOne({
      _id: body.list_id,
      board_id: body.board_id,
      is_archived: false,
    }).lean<{ _id: unknown; title: string } | null>();
    if (!list) {
      return NextResponse.json(
        { success: false, error: "Target list not found on this board" },
        { status: 400 },
      );
    }

    const last = await Card.findOne({
      list_id: body.list_id,
      is_archived: false,
    })
      .sort({ position: -1 })
      .lean<{ position: number } | null>();
    const position = (last?.position ?? 0) + 1024;

    const priority: Priority = VALID_PRIORITIES.includes(
      (body.priority ?? "medium") as Priority,
    )
      ? (body.priority as Priority)
      : "medium";

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const card = await Card.create({
      board_id: body.board_id,
      list_id: body.list_id,
      title,
      description: (body.description ?? "").slice(0, 8000),
      position,
      priority,
      start_date: parseDate(body.start_date),
      due_date: parseDate(body.due_date),
      completed_at: null,
      cover: body.cover ?? "",
      is_archived: false,
      members: Array.isArray(body.members) ? body.members : [],
      labels: Array.isArray(body.labels) ? body.labels : [],
      created_by: actor,
      updated_by: actor,
    });

    recordActivity({
      board_id: body.board_id,
      card_id: String(card._id),
      user_id: actor.id,
      user_name: actor.name,
      action: ACTIVITY_ACTIONS.CARD_CREATED,
      description: `${actor.name} added “${title}” to ${list.title}`,
    });

    return NextResponse.json(
      { success: true, data: { ...card.toObject(), id: String(card._id) } },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST card", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create card: ${message}` },
      { status: 500 },
    );
  }
}
