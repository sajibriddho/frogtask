/**
 * Profile API – returns and updates details for the currently logged-in user.
 *
 * GET /api/profile
 * PUT /api/profile
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import Role from "@/model/Role";
import { requireAuth } from "@/lib/require-permission";

void mongoose.models;

interface UserDoc {
  _id: unknown;
  name: string;
  email: string;
  user_type: string;
  status: string;
  role_id?: string;
  can_delete?: boolean;
  verified?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface RoleDoc {
  role_name: string;
}

async function loadProfile(userId: string) {
  const user = await AppUser.findById(userId)
    .select("-password")
    .lean<UserDoc | null>();
  if (!user) return null;

  const role = user.role_id
    ? await Role.findById(user.role_id)
        .select("role_name")
        .lean<RoleDoc | null>()
    : null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    user_type: user.user_type,
    status: user.status,
    role_name: role?.role_name ?? "—",
    profile_photo: "",
    created_at: user.created_at ? user.created_at.toISOString() : null,
    updated_at: user.updated_at ? user.updated_at.toISOString() : null,
    can_delete: user.can_delete !== false,
    verified: user.verified === true,
  };
}

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const profile = await loadProfile(session.user.id);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("GET /api/profile", err);
    return NextResponse.json(
      { success: false, error: "Failed to load profile" },
      { status: 500 },
    );
  }
}

interface PutBody {
  name?: string;
  email?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const userId = session.user.id;
    const body = (await req.json()) as PutBody;

    const patch: { name?: string; email?: string } = {};

    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { success: false, error: "Name cannot be empty" },
          { status: 400 },
        );
      }
      patch.name = trimmed;
    }

    if (body.email !== undefined) {
      const normalised = body.email.trim().toLowerCase();
      if (!EMAIL_RE.test(normalised)) {
        return NextResponse.json(
          { success: false, error: "Invalid email address" },
          { status: 400 },
        );
      }
      const conflict = await AppUser.findOne({
        email: normalised,
        _id: { $ne: userId },
      })
        .select("_id")
        .lean();
      if (conflict) {
        return NextResponse.json(
          { success: false, error: "Email already in use" },
          { status: 409 },
        );
      }
      patch.email = normalised;
    }

    if (Object.keys(patch).length > 0) {
      await AppUser.findByIdAndUpdate(userId, { $set: patch }, { new: false });
    }

    const profile = await loadProfile(userId);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("PUT /api/profile", err);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
