/**
 * BoardList — kanban column. `position` is a float so we can drop new
 * columns between two existing columns (next = (prev+next)/2) without
 * having to renumber every row. Archived lists are hidden from the board
 * view but retained for the Archived screen.
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IBoardList extends Document {
  board_id: string;
  title: string;
  position: number;
  is_archived: boolean;
}

const boardListSchema = new Schema<IBoardList>(
  {
    board_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    position: { type: Number, required: true, default: 0 },
    is_archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

boardListSchema.index({ board_id: 1, position: 1 });

const BoardList =
  mongoose.models.BoardList ||
  mongoose.model<IBoardList>("BoardList", boardListSchema);

export default BoardList;
