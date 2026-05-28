/**
 * Users lookup API – lightweight list for assignee dropdowns.
 * API: GET /api/users/lookup
 * Authenticated only — task assignees can be any active user.
 */

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AppUser from "@/model/User";
import { requireAuth } from "@/lib/require-permission";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const users = await AppUser.find({ status: "Active" })
      .select("_id name email")
      .sort({ name: 1 });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /api/users/lookup", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch users: ${message}` },
      { status: 500 },
    );
  }
}
