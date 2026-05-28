/**
 * CardAttachment — file/link metadata. The actual upload is handled by
 * the existing /api/uploads endpoint; we just store the resulting URL
 * (or an external link the user pasted) here.
 */

import mongoose, { Document, Schema } from "mongoose";

import type { AuditUser } from "@/types/project";

export interface ICardAttachment extends Document {
  card_id: string;
  board_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: AuditUser;
}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const cardAttachmentSchema = new Schema<ICardAttachment>(
  {
    card_id: { type: String, required: true, index: true },
    board_id: { type: String, required: true, index: true },
    file_name: { type: String, required: true, trim: true, maxlength: 256 },
    file_url: { type: String, required: true, trim: true, maxlength: 2000 },
    file_type: { type: String, default: "" },
    file_size: { type: Number, default: 0 },
    uploaded_by: { type: auditUserSchema, required: true },
  },
  { timestamps: true },
);

const CardAttachment =
  mongoose.models.CardAttachment ||
  mongoose.model<ICardAttachment>("CardAttachment", cardAttachmentSchema);

export default CardAttachment;
