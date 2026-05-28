/**
 * TaskTag — user-owned tag for grouping tasks.
 *
 * Each user owns their own tags. Tasks reference a tag via `tag_id`
 * (Task.tag_id stores the TaskTag _id as a string, or "" for untagged).
 *
 * API: GET/POST /api/task-tags, GET/PUT/DELETE /api/task-tags/:id
 */

import mongoose, { Document, Schema } from "mongoose";

export interface ITaskTag extends Document {
  user_id: string;
  name: string;
  color: string;
}

const taskTagSchema = new Schema<ITaskTag>(
  {
    user_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    color: { type: String, required: true, default: "#059669" },
  },
  { timestamps: true },
);

// Same user can't have two tags with the same case-insensitive name.
taskTagSchema.index(
  { user_id: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

const TaskTag =
  mongoose.models.TaskTag ||
  mongoose.model<ITaskTag>("TaskTag", taskTagSchema);

export default TaskTag;
