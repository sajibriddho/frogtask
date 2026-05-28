/**
 * Change the signed-in user's password.
 *
 * POST /api/profile/password
 *   Body: { currentPassword: string, newPassword: string, confirmPassword: string }
 *
 * Flow:
 *   1. Verify the caller is logged in.
 *   2. Verify `currentPassword` matches the stored hash (timing-safe).
 *   3. Validate `newPassword` (length, not equal to old, matches confirm).
 *   4. Store the new PBKDF2 hash on the AppUser document.
 *
 * Returning just `{ success: true }` — no password material is echoed back.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireAuth } from "@/lib/require-permission";

void mongoose.models;

interface Body {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const MIN_LEN = 8;

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const body = (await req.json()) as Body;
    const current = body.currentPassword ?? "";
    const next = body.newPassword ?? "";
    const confirm = body.confirmPassword ?? "";

    if (!current || !next || !confirm) {
      return NextResponse.json(
        {
          success: false,
          error: "Current, new and confirmation passwords are required",
        },
        { status: 400 },
      );
    }

    if (next.length < MIN_LEN) {
      return NextResponse.json(
        {
          success: false,
          error: `Password must be at least ${MIN_LEN} characters`,
        },
        { status: 400 },
      );
    }

    if (next !== confirm) {
      return NextResponse.json(
        { success: false, error: "New and confirmation passwords do not match" },
        { status: 400 },
      );
    }

    if (next === current) {
      return NextResponse.json(
        {
          success: false,
          error: "New password must differ from the current password",
        },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await AppUser.findById(session.user.id).select("password");
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    if (!verifyPassword(current, user.password)) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 401 },
      );
    }

    user.password = hashPassword(next);
    await user.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/profile/password", err);
    return NextResponse.json(
      { success: false, error: "Failed to change password" },
      { status: 500 },
    );
  }
}
