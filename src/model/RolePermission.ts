/**
 * RolePermission – Mongoose model linking a role to its allowed menu permission IDs.
 * API: GET/PUT /api/role-permissions/:roleId
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IRolePermission extends Document {
  role_id: string;
  permission_ids: string[];
  /** true = seeded system record; cannot be deleted via the UI or API. */
  is_system: boolean;
  created_by: { id: string; name: string };
  updated_by: { id: string; name: string };
}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    role_id: { type: String, required: true, unique: true },
    permission_ids: { type: [String], default: [] },
    is_system: { type: Boolean, default: false },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

const RolePermission =
  mongoose.models.RolePermission ||
  mongoose.model<IRolePermission>("RolePermission", rolePermissionSchema);

export default RolePermission;
