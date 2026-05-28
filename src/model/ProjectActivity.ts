/**
 * ProjectActivity — append-only log of significant board/card actions.
 *
 * Used to render the activity sidebar on a board and the timeline inside
 * a card detail drawer. Writes are fire-and-forget from the mutation
 * routes (see lib/board-activity.ts) so logging never blocks the
 * actual API response.
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IProjectActivity extends Document {
  board_id: string;
  card_id: string | null;
  user_id: string;
  user_name: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
}

const projectActivitySchema = new Schema<IProjectActivity>(
  {
    board_id: { type: String, required: true, index: true },
    card_id: { type: String, default: null, index: true },
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
    action: { type: String, required: true, index: true },
    description: { type: String, required: true, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

projectActivitySchema.index({ board_id: 1, createdAt: -1 });
projectActivitySchema.index({ card_id: 1, createdAt: -1 });

const ProjectActivity =
  mongoose.models.ProjectActivity ||
  mongoose.model<IProjectActivity>("ProjectActivity", projectActivitySchema);

export default ProjectActivity;
