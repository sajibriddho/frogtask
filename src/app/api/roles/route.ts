/**
 * Roles API – collection routes.
 * API: GET /api/roles, POST /api/roles
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Role from "@/model/Role";
import { requirePermission } from "@/lib/require-permission";

// -----
// GET /api/roles – fetch all roles
// -----

export async function GET() {
  const { error } = await requirePermission("roles");
  if (error) return error;

  try {
    await connectDB();
    const roles = await Role.find().sort({ created_at: -1 });
    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error("GET /api/roles", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch roles: ${message}` },
      { status: 500 },
    );
  }
}

// -----
// POST /api/roles – create a new role
// -----

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("roles.create");
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    // Whitelist user-supplied fields; never allow is_system from the client
    const { role_name, description, status, created_by, updated_by } = body;
    const role = await Role.create({
      role_name,
      description,
      status,
      created_by,
      updated_by,
    });
    return NextResponse.json({ success: true, data: role }, { status: 201 });
  } catch (error) {
    console.error("POST /api/roles", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create role: ${message}` },
      { status: 500 },
    );
  }
}
