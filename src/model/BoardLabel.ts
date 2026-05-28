/**
 * BoardLabel — reusable colour-coded tag scoped to a single board.
 *
 * When a label's name/colour changes we also patch every Card that
 * references it (denormalised for fast board rendering — see Card.ts).
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IBoardLabel extends Document {
  board_id: string;
  name: string;
  color: string;
}

const boardLabelSchema = new Schema<IBoardLabel>(
  {
    board_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    color: { type: String, required: true, default: "#059669" },
  },
  { timestamps: true },
);

const BoardLabel =
  mongoose.models.BoardLabel ||
  mongoose.model<IBoardLabel>("BoardLabel", boardLabelSchema);

export default BoardLabel;
