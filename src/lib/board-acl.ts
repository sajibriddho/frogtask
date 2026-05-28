/**
 * board-acl.ts
 *
 * Per-board authorization. Global permissions (via `requirePermission`)
 * gate access to the module as a whole; this module gates access to a
 * specific board based on the caller's BoardMember row.
 *
 * Role hierarchy (most → least privileged):
 *   owner   — full control, including deleting the board
 *   admin   — manage lists/cards/labels/members
 *   member  — create/edit cards, comment, manage own checklists
 *   viewer  — read-only
 *
 * Public-visibility boards grant implicit `viewer` to authenticated users
 * who aren't explicit members. Team boards grant implicit `member` to
 * authenticated users (mirrors typical SaaS "anyone in the workspace can
 * view + edit" semantics). Private boards strictly require an explicit
 * BoardMember row.
 */

import { NextResponse } from "next/server";

import Board from "@/model/Board";
import BoardMember from "@/model/BoardMember";
import { connectDB } from "@/lib/mongodb";
import type { BoardRole } from "@/types/project";

const ROLE_LEVEL: Record<BoardRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export interface BoardAccess {
  board: {
    id: string;
    title: string;
    visibility: "private" | "team" | "public";
    status: "active" | "archived";
    created_by: { id: string; name: string };
    background?: string;
    description?: string;
    is_favorite?: boolean;
  };
  role: BoardRole;
}

/**
 * Resolve the caller's effective role on `boardId`. Returns null if the
 * caller has no access (private board they don't belong to, or board
 * doesn't exist).
 */
export async function getBoardAccess(
  boardId: string,
  userId: string,
): Promise<BoardAccess | null> {
  await connectDB();

  const board = await Board.findById(boardId).lean<{
    _id: unknown;
    title: string;
    visibility: "private" | "team" | "public";
    status: "active" | "archived";
    created_by: { id: string; name: string };
    background?: string;
    description?: string;
    is_favorite?: boolean;
  } | null>();
  if (!board) return null;

  const member = await BoardMember.findOne({
    board_id: String(board._id),
    user_id: userId,
  }).lean<{ role: BoardRole } | null>();

  let role: BoardRole | null = null;
  if (member) {
    role = member.role;
  } else if (board.visibility === "public") {
    role = "viewer";
  } else if (board.visibility === "team") {
    role = "member";
  }

  if (!role) return null;

  return {
    board: { ...board, id: String(board._id) },
    role,
  };
}

/**
 * Guard helper for API routes. Returns either a 403/404 response or
 * `{ access }` with the caller's BoardAccess. Use after the global
 * `requirePermission(...)` check.
 */
export async function requireBoardRole(
  boardId: string,
  userId: string,
  required: BoardRole,
): Promise<
  | { error: NextResponse; access: null }
  | { error: null; access: BoardAccess }
> {
  const access = await getBoardAccess(boardId, userId);
  if (!access) {
    return {
      error: NextResponse.json(
        { success: false, error: "Board not found or access denied" },
        { status: 404 },
      ),
      access: null,
    };
  }

  if (ROLE_LEVEL[access.role] < ROLE_LEVEL[required]) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: `Forbidden: requires '${required}' role on this board`,
        },
        { status: 403 },
      ),
      access: null,
    };
  }

  return { error: null, access };
}

export function canManageBoard(role: BoardRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL.admin;
}
