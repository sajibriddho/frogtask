/**
 * POST /api/projects/boards/:id/duplicate
 *
 * Clone a board's metadata, lists and (optionally) its non-archived
 * cards. Members and labels are copied; comments, attachments, and the
 * activity log are NOT — those are conversation history, not template
 * data. The caller becomes the owner of the new board.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Board from "@/model/Board";
import BoardList from "@/model/BoardList";
import BoardMember from "@/model/BoardMember";
import BoardLabel from "@/model/BoardLabel";
import Card from "@/model/Card";
import { getBoardAccess } from "@/lib/board-acl";
import { recordActivity, slugify } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission(
    "projects.boards.duplicate",
  );
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

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      include_cards?: boolean;
    };
    const includeCards = body.include_cards !== false; // default true

    const original = await Board.findById(id).lean<{
      title: string;
      description: string;
      visibility: "private" | "team" | "public";
      background: string;
    } | null>();
    if (!original) {
      return NextResponse.json(
        { success: false, error: "Board not found" },
        { status: 404 },
      );
    }

    const newTitle = (body.title ?? `${original.title} (copy)`).trim();
    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const newBoard = await Board.create({
      title: newTitle,
      slug: slugify(newTitle),
      description: original.description,
      visibility: original.visibility,
      background: original.background,
      is_favorite: false,
      status: "active",
      created_by: actor,
      updated_by: actor,
    });

    await BoardMember.create({
      board_id: String(newBoard._id),
      user_id: actor.id,
      user_name: actor.name,
      user_email: session.user.email ?? "",
      role: "owner",
    });

    // Lists — keep ids mapped so we can rewrite cards.list_id.
    const sourceLists = await BoardList.find({
      board_id: id,
      is_archived: false,
    })
      .sort({ position: 1 })
      .lean<Array<{ _id: unknown; title: string; position: number }>>();

    const listIdMap = new Map<string, string>();
    for (const l of sourceLists) {
      const created = await BoardList.create({
        board_id: String(newBoard._id),
        title: l.title,
        position: l.position,
        is_archived: false,
      });
      listIdMap.set(String(l._id), String(created._id));
    }

    // Labels — keep ids mapped so we can patch card label refs.
    const sourceLabels = await BoardLabel.find({ board_id: id }).lean<
      Array<{ _id: unknown; name: string; color: string }>
    >();
    const labelIdMap = new Map<string, string>();
    for (const lbl of sourceLabels) {
      const created = await BoardLabel.create({
        board_id: String(newBoard._id),
        name: lbl.name,
        color: lbl.color,
      });
      labelIdMap.set(String(lbl._id), String(created._id));
    }

    if (includeCards) {
      const sourceCards = await Card.find({
        board_id: id,
        is_archived: false,
      })
        .sort({ position: 1 })
        .lean<
          Array<{
            list_id: string;
            title: string;
            description: string;
            position: number;
            priority: string;
            cover: string;
            members: Array<{ user_id: string; user_name: string }>;
            labels: Array<{ label_id: string; name: string; color: string }>;
          }>
        >();
      if (sourceCards.length) {
        await Card.insertMany(
          sourceCards
            .map((c) => {
              const newListId = listIdMap.get(String(c.list_id));
              if (!newListId) return null;
              return {
                board_id: String(newBoard._id),
                list_id: newListId,
                title: c.title,
                description: c.description,
                position: c.position,
                priority: c.priority,
                start_date: null,
                due_date: null,
                completed_at: null,
                cover: c.cover,
                is_archived: false,
                members: c.members,
                labels: c.labels.map((l) => ({
                  label_id: labelIdMap.get(l.label_id) ?? l.label_id,
                  name: l.name,
                  color: l.color,
                })),
                checklist_total: 0,
                checklist_done: 0,
                comment_count: 0,
                attachment_count: 0,
                created_by: actor,
                updated_by: actor,
              };
            })
            .filter(Boolean) as Array<Record<string, unknown>>,
        );
      }
    }

    recordActivity({
      board_id: String(newBoard._id),
      user_id: actor.id,
      user_name: actor.name,
      action: ACTIVITY_ACTIONS.BOARD_CREATED,
      description: `${actor.name} duplicated “${original.title}” into “${newTitle}”`,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...newBoard.toObject(), id: String(newBoard._id) },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST duplicate board", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to duplicate board: ${message}` },
      { status: 500 },
    );
  }
}
