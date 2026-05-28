/**
 * Permission – Mongoose model for the permissions collection.
 * Each document represents a single menu/route permission node.
 * Seeded from MENU_PERMISSION_TREE; is_system records cannot be deleted.
 */

import mongoose, { Document, Schema } from "mongoose";

export interface IPermission extends Document {
  permission_id: string; // unique string code, e.g. "dashboard", "master.core"
  permission_name: string; // human-readable label, e.g. "Dashboard", "Core Data"
  parent_id: string | null; // parent permission_id; null means top-level
  status: "Active" | "Inactive";
  is_system: boolean; // true = seeded by system, cannot be deleted via UI
  created_by: { id: string; name: string };
  updated_by: { id: string; name: string };
}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const permissionSchema = new Schema<IPermission>(
  {
    permission_id: { type: String, required: true, unique: true, trim: true },
    permission_name: { type: String, required: true, trim: true },
    parent_id: { type: String, default: null },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      required: true,
    },
    is_system: { type: Boolean, default: false },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

const Permission =
  mongoose.models.Permission ||
  mongoose.model<IPermission>("Permission", permissionSchema);

export default Permission;
