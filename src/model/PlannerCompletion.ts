/**
 * PlannerCompletion — per-date completion record for a PlannerBlock.
 *
 * One record per (block_id, user_id, plan_date). The block itself
 * recurs every week; this collection stores whether the user actually
 * did the planned block on a specific calendar day.
 *
 * Used to drive the streak / discipline stats on the Planner page.
 */

import mongoose, { Document, Schema } from "mongoose";

import type { AuditUser } from "@/types/task";

export type PlannerCompletionStatus = "completed" | "skipped";

export interface IPlannerCompletion
  extends Document,
    Omit<
      {
        block_id: string;
        user_id: string;
        plan_date: Date;
        status: PlannerCompletionStatus;
        completed_at: Date | null;
        completed_by: AuditUser | null;
        note: string;
      },
      never
    > {}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const plannerCompletionSchema = new Schema<IPlannerCompletion>(
  {
    block_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    plan_date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["completed", "skipped"],
      default: "completed",
      required: true,
    },
    completed_at: { type: Date, default: null },
    completed_by: { type: auditUserSchema, default: null },
    note: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

// One record per block / user / day.
plannerCompletionSchema.index(
  { block_id: 1, user_id: 1, plan_date: 1 },
  { unique: true },
);

const PlannerCompletion =
  mongoose.models.PlannerCompletion ||
  mongoose.model<IPlannerCompletion>(
    "PlannerCompletion",
    plannerCompletionSchema,
  );

export default PlannerCompletion;
