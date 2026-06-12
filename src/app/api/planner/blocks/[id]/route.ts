/**
 * Planner Block API — single-document routes.
 * PUT    /api/planner/blocks/:id   Update a planner block the caller owns.
 * DELETE /api/planner/blocks/:id   Hard-delete (block + completions).
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import PlannerBlock from "@/model/PlannerBlock";
import PlannerCompletion from "@/model/PlannerCompletion";
import { validatePlannerBlockPayload } from "@/lib/planner-payload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("planner.update");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
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

    const block = await PlannerBlock.findOneAndUpdate(
      { _id: id, user_id: session.user.id },
      { ...result.data, updated_by: actor },
      { returnDocument: "after", runValidators: true },
    );

    if (!block) {
      return NextResponse.json(
        { success: false, error: "Planner block not found" },
        { status: 404 },
      );
    }

    const obj = block.toObject();
    return NextResponse.json({
      success: true,
      data: { ...obj, id: String(obj._id) },
    });
  } catch (err) {
    console.error("PUT /api/planner/blocks/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update block: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("planner.delete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const block = await PlannerBlock.findOneAndDelete({
      _id: id,
      user_id: session.user.id,
    });

    if (!block) {
      return NextResponse.json(
        { success: false, error: "Planner block not found" },
        { status: 404 },
      );
    }

    await PlannerCompletion.deleteMany({
      block_id: id,
      user_id: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/planner/blocks/:id", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete block: ${message}` },
      { status: 500 },
    );
  }
}
