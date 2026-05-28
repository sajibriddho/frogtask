/**
 * Card — the actual task/work item that lives in a list.
 *
 * Members and labels are denormalised into the card document for fast
 * board-page rendering (one query gets every card on the board with
 * everything needed to draw it). Authoritative comment/attachment/
 * checklist counts live on this document too — they're refreshed by
 * the corresponding mutation routes.
 */

import mongoose, { Document, Schema } from "mongoose";

import type {
  AuditUser,
  CardLabelRef,
  CardMember,
  CardPriority,
} from "@/types/project";

export interface ICard extends Document {
  board_id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  priority: CardPriority;
  start_date: Date | null;
  due_date: Date | null;
  completed_at: Date | null;
  cover: string;
  is_archived: boolean;
  members: CardMember[];
  labels: CardLabelRef[];
  checklist_total: number;
  checklist_done: number;
  comment_count: number;
  attachment_count: number;
  created_by: AuditUser;
  updated_by: AuditUser;
}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const cardMemberSchema = new Schema(
  {
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
  },
  { _id: false },
);

const cardLabelSchema = new Schema(
  {
    label_id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false },
);

const cardSchema = new Schema<ICard>(
  {
    board_id: { type: String, required: true, index: true },
    list_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, default: "", maxlength: 8000 },
    position: { type: Number, required: true, default: 0 },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      required: true,
    },
    start_date: { type: Date, default: null },
    due_date: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    cover: { type: String, default: "" },
    is_archived: { type: Boolean, default: false, index: true },
    members: { type: [cardMemberSchema], default: [] },
    labels: { type: [cardLabelSchema], default: [] },
    checklist_total: { type: Number, default: 0 },
    checklist_done: { type: Number, default: 0 },
    comment_count: { type: Number, default: 0 },
    attachment_count: { type: Number, default: 0 },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  { timestamps: true },
);

cardSchema.index({ board_id: 1, list_id: 1, position: 1 });
cardSchema.index({ "members.user_id": 1, is_archived: 1 });
cardSchema.index({ due_date: 1, is_archived: 1 });

const Card =
  mongoose.models.Card || mongoose.model<ICard>("Card", cardSchema);

export default Card;
