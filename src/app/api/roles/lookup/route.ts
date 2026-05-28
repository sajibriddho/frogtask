/**
 * Roles lookup API – lightweight list for dropdowns.
 * API: GET /api/roles/lookup
 * Requires authentication only (no specific permission).
 */

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Role from "@/model/Role";
import { requireAuth } from "@/lib/require-permission";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const roles = await Role.find({ status: "Active" })
      .select("_id role_name")
      .sort({ role_name: 1 });
    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error("GET /api/roles/lookup", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch roles: ${message}` },
      { status: 500 },
    );
  }
}
