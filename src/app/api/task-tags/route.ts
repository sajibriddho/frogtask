/**
 * Task tags — collection routes.
 *
 * GET  /api/task-tags   List the caller's tags (alphabetical).
 * POST /api/task-tags   Create a new tag for the caller.
 *
 * Tags are scoped per-user; the caller's id is stamped on every row.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import TaskTag from "@/model/TaskTag";
import { TASK_TAG_COLORS } from "@/types/task-tag";

interface RawTagRow {
  _id: unknown;
  [key: string]: unknown;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export async function GET() {
  const { error, session } = await requirePermission("tasks.all");
  if (error) return error;

  try {
    await connectDB();
    const rows = await TaskTag.find({ user_id: session.user.id })
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .lean<RawTagRow[]>();
    const data = rows.map((t) => ({ ...t, id: String(t._id) }));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/task-tags", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch tags: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("tasks.all.create");
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const name = asString(body?.name).trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Tag name is required" },
        { status: 400 },
      );
    }
    if (name.length > 64) {
      return NextResponse.json(
        { success: false, error: "Tag name must be 64 characters or less" },
        { status: 400 },
      );
    }
    const color = asString(body?.color).trim() || TASK_TAG_COLORS[0];

    try {
      const tag = await TaskTag.create({
        user_id: session.user.id,
        name,
        color,
      });
      const obj = tag.toObject() as RawTagRow;
      return NextResponse.json(
        { success: true, data: { ...obj, id: String(obj._id) } },
        { status: 201 },
      );
    } catch (createErr) {
      if ((createErr as { code?: number })?.code === 11000) {
        return NextResponse.json(
          { success: false, error: "A tag with that name already exists" },
          { status: 409 },
        );
      }
      throw createErr;
    }
  } catch (err) {
    console.error("POST /api/task-tags", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create tag: ${message}` },
      { status: 500 },
    );
  }
}
