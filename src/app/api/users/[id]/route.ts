/**
 * Users API - single document routes.
 * API: GET /api/users/:id, PUT /api/users/:id, DELETE /api/users/:id
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import { hashPassword } from "@/lib/password";
import { requirePermission } from "@/lib/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// -----
// GET /api/users/:id
// -----

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission("users");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const user = await AppUser.findById(id).select("-password");
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("GET /api/users/:id", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch user: ${message}` },
      { status: 500 },
    );
  }
}

// -----
// PUT /api/users/:id - update user (password optional)
// -----

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission("users.update");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    // Whitelist user-supplied fields to prevent mass assignment
    const { name, email, user_type, role_id, status, updated_by } = body;
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (user_type !== undefined) updatePayload.user_type = user_type;
    if (role_id !== undefined) updatePayload.role_id = role_id;
    if (status !== undefined) updatePayload.status = status;
    if (updated_by !== undefined) updatePayload.updated_by = updated_by;

    // Only hash & update password if a new one was provided
    if (body.password) {
      updatePayload.password = hashPassword(body.password);
    }

    const user = await AppUser.findByIdAndUpdate(id, updatePayload, {
      returnDocument: "after",
      runValidators: true,
    }).select("-password");

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("PUT /api/users/:id", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to update user: ${message}` },
      { status: 500 },
    );
  }
}

// -----
// DELETE /api/users/:id
// -----

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission("users.delete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const user = await AppUser.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }
    if (user.can_delete === false) {
      return NextResponse.json(
        { success: false, error: "System users cannot be deleted" },
        { status: 403 },
      );
    }
    await AppUser.findByIdAndDelete(id);
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("DELETE /api/users/:id", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to delete user: ${message}` },
      { status: 500 },
    );
  }
}
