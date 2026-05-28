/**
 * POST /api/projects/boards/:id/reorder
 *
 * Persist drag-and-drop layout changes in a single transaction. The
 * client sends the *complete* desired ordering of every visible list
 * along with the cards inside each list, so we can rewrite positions
 * (and `list_id` for cards that moved between columns) deterministically
 * without having to reason about deltas.
 *
 * Body shape:
 *   {
 *     lists: [
 *       { id, position, cards: [{ id, position }, …] },
 *       …
 *     ]
 *   }
 *
 * Member-or-higher role required.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BoardList from "@/model/BoardList";
import Card from "@/model/Card";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ReorderBody {
  lists: Array<{
    id: string;
    position: number;
    cards: Array<{ id: string; position: number }>;
  }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id: boardId } = await params;

    const guard = await requireBoardRole(boardId, session.user.id, "member");
    if (guard.error) return guard.error;

    const body = (await req.json()) as ReorderBody;
    if (!Array.isArray(body?.lists)) {
      return NextResponse.json(
        { success: false, error: "Invalid reorder payload" },
        { status: 400 },
      );
    }

    // Build bulk ops — one per list, one per card.
    const listOps = body.lists.map((l, idx) => ({
      updateOne: {
        filter: { _id: l.id, board_id: boardId },
        update: {
          $set: {
            position: typeof l.position === "number" ? l.position : (idx + 1) * 1024,
          },
        },
      },
    }));

    const cardOps: Array<Record<string, unknown>> = [];
    for (const list of body.lists) {
      list.cards.forEach((c, idx) => {
        cardOps.push({
          updateOne: {
            filter: { _id: c.id, board_id: boardId },
            update: {
              $set: {
                list_id: list.id,
                position: typeof c.position === "number" ? c.position : (idx + 1) * 1024,
              },
            },
          },
        });
      });
    }

    if (listOps.length) {
      await BoardList.bulkWrite(listOps as never);
    }
    if (cardOps.length) {
      await Card.bulkWrite(cardOps as never);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST reorder", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to save layout: ${message}` },
      { status: 500 },
    );
  }
}
