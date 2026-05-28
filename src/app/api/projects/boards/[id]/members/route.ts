/**
 * Board members API.
 *
 * GET  /api/projects/boards/:id/members            List explicit members.
 * POST /api/projects/boards/:id/members            Add a member by user_id.
 */

import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { requirePermission } from "@/lib/require-permission";
import AppUser from "@/model/User";
import BoardMember from "@/model/BoardMember";
import { requireBoardRole } from "@/lib/board-acl";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_ROLES = ["owner", "admin", "member", "viewer"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("projects.boards");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "viewer");
    if (guard.error) return guard.error;

    const members = await BoardMember.find({ board_id: id })
      .sort({ joined_at: 1 })
      .lean<Array<{ _id: unknown; [k: string]: unknown }>>();
    return NextResponse.json({
      success: true,
      data: members.map((m) => ({ ...m, id: String(m._id) })),
    });
  } catch (err) {
    console.error("GET members", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch members: ${message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission(
    "projects.members.invite",
  );
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const guard = await requireBoardRole(id, session.user.id, "admin");
    if (guard.error) return guard.error;

    const body = (await req.json()) as { user_id?: string; role?: Role };
    if (!body.user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }
    const role: Role = VALID_ROLES.includes(body.role as Role)
      ? (body.role as Role)
      : "member";

    const user = await AppUser.findById(body.user_id)
      .select("name email status")
      .lean<{ name: string; email: string; status: string } | null>();
    if (!user || user.status !== "Active") {
      return NextResponse.json(
        { success: false, error: "User not found or inactive" },
        { status: 404 },
      );
    }

    const existing = await BoardMember.findOne({
      board_id: id,
      user_id: body.user_id,
    });
    if (existing) {
      existing.role = role;
      await existing.save();
      return NextResponse.json({
        success: true,
        data: { ...existing.toObject(), id: String(existing._id) },
      });
    }

    const member = await BoardMember.create({
      board_id: id,
      user_id: body.user_id,
      user_name: user.name,
      user_email: user.email,
      role,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...member.toObject(), id: String(member._id) },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST members", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to add member: ${message}` },
      { status: 500 },
    );
  }
}
