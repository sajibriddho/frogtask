/**
 * Planner Blocks API — collection routes.
 * GET  /api/planner/blocks   List the caller's planner blocks.
 * POST /api/planner/blocks   Create a new planner block for the caller.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import PlannerBlock from "@/model/PlannerBlock";
import { validatePlannerBlockPayload } from "@/lib/planner-payload";

export async function GET() {
  const { error, session } = await requirePermission("planner");
  if (error) return error;

  try {
    await connectDB();
    const blocks = await PlannerBlock.find({ user_id: session.user.id })
      .sort({ weekday: 1, start_time: 1 })
      .lean<Array<{ _id: unknown; [k: string]: unknown }>>();

    const data = blocks.map((b) => ({ ...b, id: String(b._id) }));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/planner/blocks", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to load planner: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { error, session } = await requirePermission("planner.create");
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const result = validatePlannerBlockPayload(body);
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

    const block = await PlannerBlock.create({
      ...result.data,
      user_id: session.user.id,
      created_by: actor,
      updated_by: actor,
    });

    const obj = block.toObject();
    return NextResponse.json(
      { success: true, data: { ...obj, id: String(obj._id) } },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/planner/blocks", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create block: ${message}` },
      { status: 500 },
    );
  }
}
