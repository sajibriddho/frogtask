/**
 * Users API - collection routes.
 * API: GET /api/users, POST /api/users
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import { hashPassword } from "@/lib/password";
import { requirePermission } from "@/lib/require-permission";

// -----
// GET /api/users - fetch all users (password excluded)
// -----

export async function GET() {
  const { error } = await requirePermission("users");
  if (error) return error;

  try {
    await connectDB();
    const users = await AppUser.find()
      .select("-password")
      .sort({ created_at: -1 });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /api/users", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch users: ${message}` },
      { status: 500 },
    );
  }
}

// -----
// POST /api/users - create a new user
// -----

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("users.create");
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    if (!body.password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 },
      );
    }

    // Whitelist user-supplied fields to prevent mass assignment
    const {
      name,
      email,
      user_type,
      role_id,
      status,
      created_by,
      updated_by,
    } = body;
    const user = await AppUser.create({
      name,
      email,
      user_type: user_type || "Staff",
      role_id,
      status,
      created_by,
      updated_by,
      password: hashPassword(body.password),
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safeUser } = user.toObject();
    return NextResponse.json(
      { success: true, data: safeUser },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/users", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create user: ${message}` },
      { status: 500 },
    );
  }
}
