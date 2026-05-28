/**
 * require-permission.ts
 *
 * Server-side authorization guards for Next.js App Router API routes.
 *
 * Usage (inside an API route handler):
 *
 *   const { error } = await requirePermission("roles");
 *   if (error) return error;
 *
 * Permissions are looked up **live from the database** on every call.
 * This means role/permission changes made by an admin take effect
 * immediately — the caller does not have to wait for their JWT to
 * refresh or re-login. Identity (user id) still comes from the JWT, so
 * there's only one extra DB hit per guarded request (one indexed find
 * on `role_permissions.role_id`).
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/mongodb";
import { ancestorsOf } from "@/lib/menu-permissions";
import AppUser from "@/model/User";
import RolePermission from "@/model/RolePermission";

type GuardResult =
  | { error: NextResponse; session: null }
  | { error: null; session: Session };

/**
 * Fetch the current permission_ids for `roleId`. Always reads from the
 * DB — no in-memory cache — so role-permission updates are visible to
 * the very next request.
 */
async function fetchPermissionIds(roleId: string): Promise<string[]> {
  if (!roleId) return [];
  try {
    await connectDB();
    const doc = await RolePermission.findOne({ role_id: roleId })
      .select("permission_ids")
      .lean();
    return (doc as { permission_ids?: string[] } | null)?.permission_ids ?? [];
  } catch {
    return [];
  }
}

/**
 * Verify the caller is authenticated AND currently holds `permissionId`.
 *
 * Always performs one DB lookup against the user's **current** role_id
 * so that admin-side role changes propagate immediately, without
 * waiting for the JWT to re-issue.
 *
 * @returns `{ session }` on success, or `{ error }` (ready-to-return
 *   NextResponse with 401/403) on failure.
 */
export async function requirePermission(
  permissionId: string,
): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
      session: null,
    };
  }

  // Re-read the user's role_id + status from the DB in case either
  // changed since the JWT was minted. A deactivated user should also
  // fail the check.
  await connectDB();
  const user = await AppUser.findById(session.user.id)
    .select("role_id status")
    .lean<{ role_id?: string; status?: string } | null>();

  if (!user || user.status !== "Active") {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
      session: null,
    };
  }

  const ids = await fetchPermissionIds(user.role_id ?? "");
  if (!holdsPermission(ids, permissionId)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Forbidden: insufficient permissions" },
        { status: 403 },
      ),
      session: null,
    };
  }

  return { error: null, session };
}

/**
 * Match logic for action-level permissions.
 *
 *   1. Exact match — `users.create` is in the role's grant list.
 *   2. Ancestor match — the role holds an ancestor (e.g. `users` covers
 *      `users.create`/`users.update`/`users.delete`).
 *
 * Trade-off: with ancestor matching, granting the parent confers every
 * action under it. To restrict to a subset, the admin unchecks the parent
 * and grants only the desired children individually. This keeps the model
 * simple and makes legacy parent-only grants behave the way they did
 * before action-level guards existed.
 */
function holdsPermission(grantedIds: string[], required: string): boolean {
  if (grantedIds.includes(required)) return true;
  for (const ancestor of ancestorsOf(required)) {
    if (grantedIds.includes(ancestor)) return true;
  }
  return false;
}

/**
 * Verify the caller is authenticated (any role).
 * Use this for endpoints that any logged-in user may access,
 * e.g. fetching the user's own role permissions for the sidebar.
 */
export async function requireAuth(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
      session: null,
    };
  }

  return { error: null, session };
}
