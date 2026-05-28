/**
 * CardComment — discussion thread on a card. Edit/delete is restricted
 * to the comment author at the route layer.
 */

import mongoose, { Document, Schema } from "mongoose";

export interface ICardComment extends Document {
  card_id: string;
  board_id: string;
  user_id: string;
  user_name: string;
  body: string;
}

const cardCommentSchema = new Schema<ICardComment>(
  {
    card_id: { type: String, required: true, index: true },
    board_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true },
);

const CardComment =
  mongoose.models.CardComment ||
  mongoose.model<ICardComment>("CardComment", cardCommentSchema);

export default CardComment;
