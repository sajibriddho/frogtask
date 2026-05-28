/**
 * Board — top-level project container in the Project Management module.
 *
 * Each board hangs off a creator + a member list (see BoardMember). Lists,
 * cards, labels and activity logs all reference `board_id`. Soft-archive
 * is recorded as `status: "archived"`; we keep the document so cards
 * remain queryable in the Archived view.
 */

import mongoose, { Document, Schema } from "mongoose";

import type {
  AuditUser,
  BoardStatus,
  BoardVisibility,
} from "@/types/project";

export interface IBoard extends Document {
  title: string;
  slug: string;
  description: string;
  visibility: BoardVisibility;
  background: string;
  is_favorite: boolean;
  status: BoardStatus;
  created_by: AuditUser;
  updated_by: AuditUser;
}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const boardSchema = new Schema<IBoard>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, index: true },
    description: { type: String, default: "", maxlength: 4000 },
    visibility: {
      type: String,
      enum: ["private", "team", "public"],
      default: "team",
      required: true,
    },
    background: { type: String, default: "emerald" },
    is_favorite: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      required: true,
      index: true,
    },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  { timestamps: true },
);

boardSchema.index({ "created_by.id": 1, status: 1 });

const Board =
  mongoose.models.Board || mongoose.model<IBoard>("Board", boardSchema);

export default Board;
