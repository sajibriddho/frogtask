/**
 * PUT/DELETE a single board member.
 * Both require `admin` role on the board, except the last owner — who
 * cannot be removed or demoted (we always keep at least one owner).
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import BoardMember from "@/model/BoardMember";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

const VALID_ROLES = ["owner", "admin", "member", "viewer"] as const;
type Role = (typeof VALID_ROLES)[number];

async function ensureOwnerSurvives(
  boardId: string,
  excludingMemberId: string,
  newRole?: Role,
): Promise<boolean> {
  const owners = await BoardMember.find({
    board_id: boardId,
    role: "owner",
  }).lean<Array<{ _id: unknown }>>();
  if (owners.length > 1) return true;
  if (owners.length === 1 && String(owners[0]._id) !== excludingMemberId) {
    return true;
  }
  // Only the row being modified is an owner — the new role must still be owner.
  return newRole === "owner";
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id, memberId } = await params;
    const guard = await requireBoardRole(id, session.user.id, "admin");
    if (guard.error) return guard.error;

    const body = (await req.json()) as { role?: Role };
    const role: Role = VALID_ROLES.includes(body.role as Role)
      ? (body.role as Role)
      : "member";

    if (!(await ensureOwnerSurvives(id, memberId, role))) {
      return NextResponse.json(
        { success: false, error: "A board must have at least one owner." },
        { status: 400 },
      );
    }

    const member = await BoardMember.findOneAndUpdate(
      { _id: memberId, board_id: id },
      { role },
      { returnDocument: "after" },
    );
    if (!member) {
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      data: { ...member.toObject(), id: String(member._id) },
    });
  } catch (err) {
    console.error("PUT member", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update member: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission(
    "projects.members.remove",
  );
  if (error) return error;

  try {
    await connectDB();
    const { id, memberId } = await params;
    const guard = await requireBoardRole(id, session.user.id, "admin");
    if (guard.error) return guard.error;

    if (!(await ensureOwnerSurvives(id, memberId))) {
      return NextResponse.json(
        { success: false, error: "A board must have at least one owner." },
        { status: 400 },
      );
    }

    const removed = await BoardMember.findOneAndDelete({
      _id: memberId,
      board_id: id,
    });
    if (!removed) {
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE member", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to remove member: ${message}` },
      { status: 500 },
    );
  }
}
