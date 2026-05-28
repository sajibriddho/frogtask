/**
 * BoardMember — links a user to a board with a role. The board's creator
 * is always seeded as an "owner". `role` controls what the user is
 * allowed to do via `assertBoardRole()` server-side (see lib/board-acl).
 */

import mongoose, { Document, Schema } from "mongoose";

import type { BoardRole } from "@/types/project";

export interface IBoardMember extends Document {
  board_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: BoardRole;
  joined_at: Date;
}

const boardMemberSchema = new Schema<IBoardMember>(
  {
    board_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    user_name: { type: String, required: true },
    user_email: { type: String, default: "" },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
      required: true,
    },
    joined_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// One row per (board, user) — duplicate adds simply update the role.
boardMemberSchema.index({ board_id: 1, user_id: 1 }, { unique: true });

const BoardMember =
  mongoose.models.BoardMember ||
  mongoose.model<IBoardMember>("BoardMember", boardMemberSchema);

export default BoardMember;
