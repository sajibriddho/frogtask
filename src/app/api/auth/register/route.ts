/**
 * POST /api/auth/register — public self-registration.
 *
 * Creates a new user with status="Active" so they can sign in
 * immediately. The register page calls `signIn()` right after this
 * succeeds to automatically log the new user in.
 *
 * Body: { name: string, email: string, password: string }
 *
 * Response (201): { success: true, data: { id, email, status } }
 *
 * Notes:
 *   - This endpoint is PUBLIC — it must not require authentication.
 *   - New accounts are assigned the seeded "General User" role by default
 *     (everything except the System section). Admins can change the role
 *     later from the user-management screen.
 *   - `created_by` / `updated_by` are set to a synthetic "self" audit
 *     user since there is no logged-in actor.
 *   - Admins can still set existing users to "Pending" or "Inactive"
 *     manually. The legacy approval flow on the user-management page
 *     keeps working for any user that's not already Active.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import Role from "@/model/Role";
import { hashPassword } from "@/lib/password";

interface Body {
  name?: string;
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SELF_REGISTRATION_AUDIT = {
  id: "self-registration",
  name: "Self-registration",
};

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

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  // ── Validation ──────────────────────────────────────────────────────
  if (!name || name.length < 2) {
    return NextResponse.json(
      { success: false, error: "Name must be at least 2 characters." },
      { status: 400 },
    );
  }
  if (name.length > 100) {
    return NextResponse.json(
      { success: false, error: "Name must be 100 characters or less." },
      { status: 400 },
    );
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "Please provide a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json(
      { success: false, error: "Password must include a letter and a digit." },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    // Reject duplicates without leaking which side of the field is taken —
    // a single generic message is enough.
    const existing = await AppUser.findOne({ email }).select("_id").lean();
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists.",
        },
        { status: 409 },
      );
    }

    // Assign the seeded "General User" role by default. If the seeder has
    // not been run yet the role won't exist — fall back to empty role_id
    // so registration still succeeds and an admin can set one later.
    const generalRole = await Role.findOne({ role_name: "General User" })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    const user = await AppUser.create({
      name,
      email,
      password: hashPassword(password),
      user_type: "Staff",
      role_id: generalRole ? String(generalRole._id) : "",
      status: "Active",
      created_by: SELF_REGISTRATION_AUDIT,
      updated_by: SELF_REGISTRATION_AUDIT,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(user._id),
          email: user.email,
          status: user.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/auth/register", err);
    // Mongo duplicate-key (race condition) — surface the same generic
    // 409 we used above so callers can rely on a single shape.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email already exists.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Could not create account. Please try again." },
      { status: 500 },
    );
  }
}
