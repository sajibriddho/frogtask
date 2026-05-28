/**
 * Permissions API - collection route.
 * API: GET /api/permissions
 */

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Permission from "@/model/Permission";
import { requirePermission } from "@/lib/require-permission";
import {
  MENU_PERMISSION_TREE,
  getAllPermissionIds,
} from "@/lib/menu-permissions";

// -----
// GET /api/permissions - fetch active permissions for role assignment tree
// -----

export async function GET() {
  const { error } = await requirePermission("roles");
  if (error) return error;

  try {
    await connectDB();
    const permissions = await Permission.find({ status: "Active" })
      .select("permission_id permission_name parent_id status")
      .lean();

    // Keep API output aligned with seeded sidebar/tree order.
    const orderedIds = getAllPermissionIds(MENU_PERMISSION_TREE);
    const indexById = new Map(orderedIds.map((id, idx) => [id, idx]));

    permissions.sort((a, b) => {
      const aIdx = indexById.get(a.permission_id) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = indexById.get(b.permission_id) ?? Number.MAX_SAFE_INTEGER;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return a.permission_id.localeCompare(b.permission_id);
    });

    return NextResponse.json({ success: true, data: permissions });
  } catch (error) {
    console.error("GET /api/permissions", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch permissions: ${message}` },
      { status: 500 },
    );
  }
}
