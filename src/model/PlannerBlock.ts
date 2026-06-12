/**
 * PlannerBlock — Mongoose model for a single weekly planner entry.
 *
 * Each block represents a recurring time-block in the user's weekly plan:
 * "On <weekday>, from <start_time> to <end_time>, do <title>".
 *
 * Per-occurrence completion is recorded in `planner_completions` so ticking
 * Monday's 9-10 block does not erase next Monday's slot — the block keeps
 * recurring every week until the user deletes it.
 *
 * API: GET/POST /api/planner/blocks, PUT/DELETE /api/planner/blocks/:id
 */

import mongoose, { Document, Schema } from "mongoose";

import type { AuditUser, Weekday } from "@/types/task";

export interface IPlannerBlock
  extends Document,
    Omit<
      {
        user_id: string;
        weekday: Weekday;
        start_time: string;
        end_time: string;
        title: string;
        description: string;
        color: string;
        icon: string;
        priority: "low" | "medium" | "high";
        created_by: AuditUser;
        updated_by: AuditUser;
      },
      never
    > {}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const plannerBlockSchema = new Schema<IPlannerBlock>(
  {
    user_id: { type: String, required: true, index: true },
    weekday: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    start_time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    end_time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 1000 },
    color: { type: String, default: "#059669" },
    icon: { type: String, default: "" },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  { timestamps: true },
);

plannerBlockSchema.index({ user_id: 1, weekday: 1, start_time: 1 });

const PlannerBlock =
  mongoose.models.PlannerBlock ||
  mongoose.model<IPlannerBlock>("PlannerBlock", plannerBlockSchema);

export default PlannerBlock;
