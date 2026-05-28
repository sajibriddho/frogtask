/**
 * Roles API – single document routes.
 * API: GET /api/roles/:id, PUT /api/roles/:id, DELETE /api/roles/:id
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Role from "@/model/Role";
import { requirePermission } from "@/lib/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// -----
// GET /api/roles/:id – get single role details
// -----

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission("roles");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const role = await Role.findById(id);
    if (!role) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("GET /api/roles/:id", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch role" },
      { status: 500 },
    );
  }
}

// -----
// PUT /api/roles/:id – update role information
// -----

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission("roles.update");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const existing = await Role.findById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 },
      );
    }

    // is_system is immutable via the API in both directions:
    // - cannot be removed from a system role
    // - cannot be promoted onto a non-system role
    delete body.is_system;

    // Whitelist only the fields users are allowed to change
    const { role_name, description, status, updated_by } = body;
    const updatePayload: Record<string, unknown> = {};
    if (role_name !== undefined) updatePayload.role_name = role_name;
    if (description !== undefined) updatePayload.description = description;
    if (status !== undefined) updatePayload.status = status;
    if (updated_by !== undefined) updatePayload.updated_by = updated_by;

    const role = await Role.findByIdAndUpdate(id, updatePayload, {
      returnDocument: "after",
      runValidators: true,
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("PUT /api/roles/:id", error);
    return NextResponse.json(
      { success: false, error: "Failed to update role" },
      { status: 500 },
    );
  }
}

// -----
// DELETE /api/roles/:id – delete a role
// -----

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requirePermission("roles.delete");
  if (error) return error;

  try {
    await connectDB();
    const { id } = await params;

    const role = await Role.findById(id);
    if (!role) {
      return NextResponse.json(
        { success: false, error: "Role not found" },
        { status: 404 },
      );
    }

    if (role.is_system) {
      return NextResponse.json(
        { success: false, error: "System roles cannot be deleted." },
        { status: 403 },
      );
    }

    await role.deleteOne();
    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error("DELETE /api/roles/:id", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete role" },
      { status: 500 },
    );
  }
}
