/**
 * Role Permissions API – single role routes.
 * API: GET /api/role-permissions/:roleId  → returns { role_id, permission_ids }
 *      PUT /api/role-permissions/:roleId  → upserts permission_ids for a role
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import RolePermission from "@/model/RolePermission";
import { requireAuth, requirePermission } from "@/lib/require-permission";

interface RouteParams {
  params: Promise<{ roleId: string }>;
}

// -----
// GET /api/role-permissions/:roleId
// Any authenticated user may fetch role permissions (needed by the Sidebar
// to load the current user's own permission set).
// -----

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const { roleId } = await params;

    const doc = await RolePermission.findOne({ role_id: roleId });
    return NextResponse.json({
      success: true,
      data: {
        role_id: roleId,
        permission_ids: doc?.permission_ids ?? [],
      },
    });
  } catch (error) {
    console.error("GET /api/role-permissions/:roleId", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch permissions" },
      { status: 500 },
    );
  }
}

// -----
// PUT /api/role-permissions/:roleId – upsert permission list
// Requires roles permission
// -----

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { error, session } = await requirePermission("roles.assign");
  if (error) return error;
  try {
    await connectDB();
    const { roleId } = await params;
    const body = (await req.json()) as {
      permission_ids: string[];
      updated_by?: { id: string; name: string };
    };

    const updated_by = body.updated_by ?? {
      id: session.user.id,
      name: session.user.name ?? "System",
    };

    const doc = await RolePermission.findOneAndUpdate(
      { role_id: roleId },
      {
        $set: {
          permission_ids: body.permission_ids ?? [],
          updated_by,
        },
        $setOnInsert: {
          created_by: updated_by,
          is_system: false,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("PUT /api/role-permissions/:roleId", error);
    return NextResponse.json(
      { success: false, error: "Failed to update permissions" },
      { status: 500 },
    );
  }
}
