/**
 * Role – Mongoose model for access control roles.
 * API: GET/POST /api/roles, PUT/DELETE /api/roles/:id
 */

import mongoose, { Document, Schema } from "mongoose";
import type { Role } from "@/types/role";

/** Mongoose document interface derived from the shared Role type. */
export interface IRole extends Omit<Role, "id">, Document {}

// -----
// Sub-schemas
// -----

/** Reusable sub-schema for audit user (created_by / updated_by). */
const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

// -----
// Schema
// -----

const roleSchema = new Schema<IRole>(
  {
    role_name: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], required: true },
    /** true = seeded system role; cannot be deleted via the UI or API. */
    is_system: { type: Boolean, default: false },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  {
    /** Maps createdAt → created_at and updatedAt → updated_at automatically. */
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

const Role = mongoose.models.Role || mongoose.model<IRole>("Role", roleSchema);

export default Role;
