/**
 * Checklist — a named list of items attached to a card. Items are an
 * embedded subdocument array because they're always loaded together with
 * their parent checklist and the cardinality is bounded.
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IChecklistItem {
  _id?: mongoose.Types.ObjectId;
  text: string;
  is_completed: boolean;
  assigned_to: string | null;
  due_date: Date | null;
  position: number;
}

export interface IChecklist extends Document {
  card_id: string;
  title: string;
  position: number;
  items: IChecklistItem[];
}

const checklistItemSchema = new Schema<IChecklistItem>(
  {
    text: { type: String, required: true, trim: true, maxlength: 500 },
    is_completed: { type: Boolean, default: false },
    assigned_to: { type: String, default: null },
    due_date: { type: Date, default: null },
    position: { type: Number, default: 0 },
  },
  { _id: true },
);

const checklistSchema = new Schema<IChecklist>(
  {
    card_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    position: { type: Number, default: 0 },
    items: { type: [checklistItemSchema], default: [] },
  },
  { timestamps: true },
);

const Checklist =
  mongoose.models.Checklist ||
  mongoose.model<IChecklist>("Checklist", checklistSchema);

export default Checklist;
