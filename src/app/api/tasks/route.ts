/**
 * Tasks API — collection routes (per-user; users own their own tasks).
 * GET  /api/tasks   List the caller's task rules (with filters).
 * POST /api/tasks   Create a new task rule for the caller.
 *
 * Filters (query string):
 *   q=...                 (title contains)
 *   schedule_type=<date_specific|daily|weekly>
 *   priority=<low|medium|high|urgent>
 *   status=<Active|Inactive>
 *
 * `assigned_to` is set automatically to the caller's user id and is
 * never read from the request body — every task is owned by its
 * creator.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import Task from "@/model/Task";
import { validateTaskPayload } from "@/lib/task-payload";

interface RawTaskRow {
  _id: unknown;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/tasks
// ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { error, session } = await requirePermission("tasks.all");
  if (error) return error;

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const schedule_type = (searchParams.get("schedule_type") ?? "").trim();
    const priority = (searchParams.get("priority") ?? "").trim();
    const status = (searchParams.get("status") ?? "").trim();
    const tag_id = (searchParams.get("tag_id") ?? "").trim();

    const filter: Record<string, unknown> = {
      assigned_to: session.user.id,
      deleted_at: null,
    };
    if (q) filter.title = { $regex: q, $options: "i" };
    if (schedule_type) filter.schedule_type = schedule_type;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;
    if (tag_id) filter.tag_id = tag_id === "__none__" ? "" : tag_id;

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .lean<RawTaskRow[]>();

    const data = tasks.map((t) => ({ ...t, id: String(t._id) }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/tasks", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch tasks: ${message}` },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/tasks
// ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("tasks.all.create");
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const result = validateTaskPayload(body);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    const actor = {
      id: session.user.id,
      name: session.user.name ?? "Unknown",
    };

    const task = await Task.create({
      ...result.data,
      assigned_to: session.user.id,
      created_by: actor,
      updated_by: actor,
    });

    return NextResponse.json(
      { success: true, data: task.toObject() },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/tasks", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create task: ${message}` },
      { status: 500 },
    );
  }
}
