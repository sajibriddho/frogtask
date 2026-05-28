/**
 * AppUser - Mongoose model for system users (access control).
 * API: GET/POST /api/users, PUT/DELETE /api/users/:id
 */

import mongoose, { Document, Schema } from "mongoose";
import type { AppUser } from "@/types/user";

export interface IAppUser extends Omit<AppUser, "id" | "role_name">, Document {}

const auditUserSchema = {
  id: { type: String, required: true },
  name: { type: String, required: true },
};

const appUserSchema = new Schema<IAppUser>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    user_type: {
      type: String,
      enum: ["Staff", "Guest", "System"],
      required: true,
      default: "Staff",
    },
    can_delete: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    role_id: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Pending"],
      required: true,
      default: "Active",
    },
    created_by: { type: auditUserSchema, required: true },
    updated_by: { type: auditUserSchema, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

const AppUser =
  mongoose.models.AppUser || mongoose.model<IAppUser>("AppUser", appUserSchema);

export default AppUser;
