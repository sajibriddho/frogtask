/**
 * Card single-document routes.
 *
 * GET    /api/projects/cards/:id   Card + checklists + comments + attachments.
 * PUT    /api/projects/cards/:id   Patch card fields. Setting `due_date`,
 *                                    `completed_at`, members or labels
 *                                    emits dedicated activity entries.
 * DELETE /api/projects/cards/:id   Archive (soft).  ?hard=1 deletes
 *                                    everything (admin role required).
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Card from "@/model/Card";
import Checklist from "@/model/Checklist";
import CardComment from "@/model/CardComment";
import CardAttachment from "@/model/CardAttachment";
import { requireBoardRole } from "@/lib/board-acl";
import { recordActivity } from "@/lib/board-activity";
import { ACTIVITY_ACTIONS } from "@/types/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof VALID_PRIORITIES)[number];

function parseDate(input: unknown): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  if (typeof input !== "string") return undefined;
  const d = new Date(input);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const card = await Card.findById(id).lean<{
      _id: unknown;
      board_id: string;
      [k: string]: unknown;
    } | null>();
    if (!card) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    const guard = await requireBoardRole(
      card.board_id,
      session.user.id,
      "viewer",
    );
    if (guard.error) return guard.error;

    const [checklists, comments, attachments] = await Promise.all([
      Checklist.find({ card_id: id })
        .sort({ position: 1, createdAt: 1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
      CardComment.find({ card_id: id })
        .sort({ createdAt: 1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
      CardAttachment.find({ card_id: id })
        .sort({ createdAt: -1 })
        .lean<Array<{ _id: unknown; [k: string]: unknown }>>(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        card: { ...card, id: String(card._id) },
        checklists: checklists.map((c) => ({
          ...c,
          id: String(c._id),
          items: ((c.items as Array<{ _id: unknown; [k: string]: unknown }>) ?? []).map(
            (it) => ({ ...it, id: String(it._id) }),
          ),
        })),
        comments: comments.map((c) => ({ ...c, id: String(c._id) })),
        attachments: attachments.map((a) => ({ ...a, id: String(a._id) })),
      },
    });
  } catch (err) {
    console.error("GET card", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch card: ${message}` },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const card = await Card.findById(id);
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

    const body = (await req.json()) as Partial<{
      title: string;
      description: string;
      priority: Priority;
      start_date: string | null;
      due_date: string | null;
      completed_at: string | null;
      cover: string;
      list_id: string;
      members: Array<{ user_id: string; user_name: string }>;
      labels: Array<{ label_id: string; name: string; color: string }>;
    }>;

    const update: Record<string, unknown> = {};
    const previous: {
      title: string;
      list_id: string;
      due_date: Date | null;
      completed_at: Date | null;
      members: string[];
      labels: string[];
    } = {
      title: card.title,
      list_id: card.list_id,
      due_date: card.due_date,
      completed_at: card.completed_at,
      members: card.members.map((m: { user_id: string }) => m.user_id),
      labels: card.labels.map((l: { label_id: string }) => l.label_id),
    };

    if (typeof body.title === "string" && body.title.trim()) {
      update.title = body.title.trim();
    }
    if (typeof body.description === "string") {
      update.description = body.description.slice(0, 8000);
    }
    if (
      typeof body.priority === "string" &&
      VALID_PRIORITIES.includes(body.priority as Priority)
    ) {
      update.priority = body.priority;
    }
    if (typeof body.cover === "string") {
      update.cover = body.cover;
    }
    if (typeof body.list_id === "string" && body.list_id) {
      update.list_id = body.list_id;
    }

    const start = parseDate(body.start_date);
    if (start !== undefined) update.start_date = start;
    const due = parseDate(body.due_date);
    if (due !== undefined) update.due_date = due;
    const completed = parseDate(body.completed_at);
    if (completed !== undefined) update.completed_at = completed;

    if (Array.isArray(body.members)) update.members = body.members;
    if (Array.isArray(body.labels)) update.labels = body.labels;

    update.updated_by = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const updated = await Card.findByIdAndUpdate(id, update, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    // ── Activity emissions ─────────────────────────────────────────
    const actorName = session.user.name ?? "Someone";
    if (update.list_id && update.list_id !== previous.list_id) {
      recordActivity({
        board_id: card.board_id,
        card_id: id,
        user_id: session.user.id,
        user_name: actorName,
        action: ACTIVITY_ACTIONS.CARD_MOVED,
        description: `${actorName} moved “${updated.title}” to a new list`,
        metadata: { from: previous.list_id, to: update.list_id },
      });
    }
    if (
      due !== undefined &&
      String(due ?? "") !== String(previous.due_date ?? "")
    ) {
      recordActivity({
        board_id: card.board_id,
        card_id: id,
        user_id: session.user.id,
        user_name: actorName,
        action: ACTIVITY_ACTIONS.DUE_DATE_CHANGED,
        description: due
          ? `${actorName} set the due date to ${due.toISOString().slice(0, 10)}`
          : `${actorName} cleared the due date`,
      });
    }
    if (Array.isArray(body.members)) {
      const next = new Set(body.members.map((m) => m.user_id));
      const added = body.members
        .filter((m) => !previous.members.includes(m.user_id))
        .map((m) => m.user_name);
      const removed = previous.members.filter((m) => !next.has(m));
      added.forEach((name) =>
        recordActivity({
          board_id: card.board_id,
          card_id: id,
          user_id: session.user.id,
          user_name: actorName,
          action: ACTIVITY_ACTIONS.MEMBER_ASSIGNED,
          description: `${actorName} assigned ${name}`,
        }),
      );
      removed.forEach(() =>
        recordActivity({
          board_id: card.board_id,
          card_id: id,
          user_id: session.user.id,
          user_name: actorName,
          action: ACTIVITY_ACTIONS.MEMBER_REMOVED,
          description: `${actorName} removed an assignee`,
        }),
      );
    }
    if (Array.isArray(body.labels)) {
      const nextLabels = new Set(body.labels.map((l) => l.label_id));
      const added = body.labels.filter(
        (l) => !previous.labels.includes(l.label_id),
      );
      const removed = previous.labels.filter((l) => !nextLabels.has(l));
      added.forEach((l) =>
        recordActivity({
          board_id: card.board_id,
          card_id: id,
          user_id: session.user.id,
          user_name: actorName,
          action: ACTIVITY_ACTIONS.LABEL_ADDED,
          description: `${actorName} added label “${l.name}”`,
        }),
      );
      removed.forEach(() =>
        recordActivity({
          board_id: card.board_id,
          card_id: id,
          user_id: session.user.id,
          user_name: actorName,
          action: ACTIVITY_ACTIONS.LABEL_REMOVED,
          description: `${actorName} removed a label`,
        }),
      );
    }
    if (
      Object.keys(update).length > 1 && // updated_by always present
      !update.list_id &&
      due === undefined &&
      !Array.isArray(body.members) &&
      !Array.isArray(body.labels)
    ) {
      recordActivity({
        board_id: card.board_id,
        card_id: id,
        user_id: session.user.id,
        user_name: actorName,
        action: ACTIVITY_ACTIONS.CARD_UPDATED,
        description: `${actorName} updated “${updated.title}”`,
      });
    }

    return NextResponse.json({
      success: true,
      data: { ...updated.toObject(), id: String(updated._id) },
    });
  } catch (err) {
    console.error("PUT card", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update card: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "1";

    const card = await Card.findById(id);
    if (!card) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 },
      );
    }

    const guard = await requireBoardRole(
      card.board_id,
      session.user.id,
      hard ? "admin" : "member",
    );
    if (guard.error) return guard.error;

    if (hard) {
      await Promise.all([
        Card.deleteOne({ _id: id }),
        Checklist.deleteMany({ card_id: id }),
        CardComment.deleteMany({ card_id: id }),
        CardAttachment.deleteMany({ card_id: id }),
      ]);
    } else {
      await Card.findByIdAndUpdate(id, { is_archived: true });
    }

    recordActivity({
      board_id: card.board_id,
      card_id: id,
      user_id: session.user.id,
      user_name: session.user.name ?? "Someone",
      action: ACTIVITY_ACTIONS.CARD_ARCHIVED,
      description: `${session.user.name ?? "Someone"} ${
        hard ? "deleted" : "archived"
      } “${card.title}”`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE card", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to archive card: ${message}` },
      { status: 500 },
    );
  }
}
