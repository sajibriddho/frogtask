/**
 * Role types for Access Control.
 * Staff belong to a Role.
 * Import from "@/types/role".
 */

import type { AuditFields } from "@/types/common";

export type RoleStatus = "Active" | "Inactive";

/** Role record - job/position definition. */
export interface Role extends AuditFields {
  id: string;
  role_name: string;
  description: string;
  status: RoleStatus;
  /** true = seeded system role; cannot be deleted or have is_system toggled via the UI. */
  is_system?: boolean;
}
