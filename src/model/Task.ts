/**
 * Task — Mongoose model for the task RULE/template.
 *
 * One Task document = "this task should occur on these dates / weekdays".
 * Per-day completion is recorded in `task_instances`, never on this doc —
 * that way completing a daily task on Monday doesn't end the rule.
 *
 * API: GET/POST /api/tasks, GET/PUT/DELETE /api/tasks/:id, PATCH /api/tasks/:id/status
 */

import mongoose, { Document, Schema } from "mongoose";

import type {
  TaskPriority,
  TaskScheduleType,
  TaskStatus,
  Weekday,
  AuditUser,
} from "@/types/task";

export interface ITask
  extends Document,
    Omit<
      {
        title: string;
        description: string;
        schedule_type: TaskScheduleType;
        task_date: Date | null;
        start_date: Date | null;
        end_date: Date | null;
        repeat_days: Weekday[];
        assigned_to: string;
        priority: TaskPriority;
        category_id: string;
        tag_id: string;
        reminder_time: string;
        status: TaskStatus;
        created_by: AuditUser;
        updated_by: AuditUser;
        deleted_at: Date | null;
      },
      never
    > {}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    schedule_type: {
      type: String,
      enum: ["date_specific", "daily", "weekly", "date_range"],
      required: true,
    },
    task_date: { type: Date, default: null },
    start_date: { type: Date, default: null },
    end_date: { type: Date, default: null },
    repeat_days: {
      type: [Number],
      default: [],
      validate: {
        validator: (arr: number[]) =>
          arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 6),
        message: "repeat_days must be integers 0-6",
      },
    },
    assigned_to: { type: String, required: true, index: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      required: true,
    },
    category_id: { type: String, default: "" },
    tag_id: { type: String, default: "", index: true },
    reminder_time: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      required: true,
      index: true,
    },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
    deleted_at: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  },
);

// Frequently-used filter: active, not-deleted, by assignee.
taskSchema.index({ assigned_to: 1, status: 1, deleted_at: 1 });

const Task =
  mongoose.models.Task || mongoose.model<ITask>("Task", taskSchema);

export default Task;
