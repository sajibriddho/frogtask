/**
 * Permission types for Access Control.
 * Permissions can be assigned to roles for role-based access.
 * Import from "@/types/permission".
 */

export type PermissionStatus = "Active" | "Inactive";

/** Permission record - e.g. dashboard.view, staff.create. */
export interface Permission {
  id: string;
  permission_name: string;
  permission_code: string;
  description?: string;
  status: PermissionStatus;
}
