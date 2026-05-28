/**
 * TaskInstance — Mongoose model for per-day task completion records.
 *
 * Created lazily on the Today's Tasks page (find-or-create). One record
 * per (task_id, user_id, task_date). Marking complete only writes here —
 * never to the parent Task — so daily/weekly schedules continue running.
 *
 * API: GET /api/task-instances/today, PATCH /api/task-instances/:id
 */

import mongoose, { Document, Schema } from "mongoose";

import type { AuditUser, TaskInstanceStatus } from "@/types/task";

export interface ITaskInstance
  extends Document,
    Omit<
      {
        task_id: string;
        user_id: string;
        task_date: Date;
        status: TaskInstanceStatus;
        completed_at: Date | null;
        completed_by: AuditUser | null;
        remarks: string;
      },
      never
    > {}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const taskInstanceSchema = new Schema<ITaskInstance>(
  {
    task_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    task_date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "skipped", "cancelled"],
      default: "pending",
      required: true,
    },
    completed_at: { type: Date, default: null },
    completed_by: { type: auditUserSchema, default: null },
    remarks: { type: String, default: "", maxlength: 1000 },
  },
  {
    timestamps: true,
  },
);

// Hard de-dup guard: one instance per task / user / day. Spec requirement.
taskInstanceSchema.index(
  { task_id: 1, user_id: 1, task_date: 1 },
  { unique: true },
);

const TaskInstance =
  mongoose.models.TaskInstance ||
  mongoose.model<ITaskInstance>("TaskInstance", taskInstanceSchema);

export default TaskInstance;
