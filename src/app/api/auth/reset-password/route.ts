/**
 * POST /api/auth/reset-password
 *
 * Final step of the Forgot Password flow. Exchanges a verified OTP's
 * short-lived `resetToken` for a password update on the matching user.
 *
 * Body: { email, resetToken, newPassword, confirmPassword }
 * Response: { success: true, data: { email: string } }
 *
 * Security:
 *   - Timing-safe token comparison happens in `consumeReset`.
 *   - The OTP record is marked consumed *only* after a successful
 *     password write so a failed save doesn't burn the user's session.
 *   - Password strength validated here; UI validates the same rules.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  PasswordResetError,
  consumeReset,
} from "@/lib/password-reset";
import { hashPassword } from "@/lib/password";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";

void mongoose.models;

interface Body {
  email?: string;
  resetToken?: string;
  newPassword?: string;
  confirmPassword?: string;
}

/** Min 8 chars, at least one letter and one digit. */
function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Password must contain at least one letter.";
  if (!/\d/.test(pw)) return "Password must contain at least one digit.";
  if (pw.length > 128) return "Password is too long.";
  return null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const email = String(body.email ?? "").trim();
  const resetToken = String(body.resetToken ?? "").trim();
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!email || !resetToken) {
    return NextResponse.json(
      { success: false, error: "Missing reset session. Please restart." },
      { status: 400 },
    );
  }
  if (!newPassword || !confirmPassword) {
    return NextResponse.json(
      { success: false, error: "Please fill both password fields." },
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { success: false, error: "Passwords do not match." },
      { status: 400 },
    );
  }
  const strengthIssue = validatePasswordStrength(newPassword);
  if (strengthIssue) {
    return NextResponse.json(
      { success: false, error: strengthIssue },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const { userId, record } = await consumeReset(email, resetToken);

    const user = await AppUser.findById(userId).select("_id email status");
    if (!user || user.status !== "Active") {
      throw new PasswordResetError(
        "Account is no longer available.",
        "user_inactive",
        400,
      );
    }

    user.password = hashPassword(newPassword);
    user.updated_by = {
      id: String(user._id),
      name: user.email ?? "self-reset",
    };
    await user.save();

    // Only now mark the OTP consumed (on successful password write).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = record as any;
    rec.consumed = true;
    rec.resetTokenHash = null;
    await rec.save();

    return NextResponse.json({
      success: true,
      data: { email: user.email },
    });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("POST /api/auth/reset-password", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
