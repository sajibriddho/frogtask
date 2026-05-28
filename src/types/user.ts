/**
 * System user types for User Role Assignment.
 * Import from "@/types/user".
 */

import type { AuditFields } from "@/types/common";

export type UserType = "Staff" | "Guest" | "System";
/**
 * Account lifecycle states.
 *  - Pending  → self-registered, awaiting an admin to approve. Cannot log in.
 *  - Active   → fully provisioned. Can log in.
 *  - Inactive → disabled by an admin. Cannot log in.
 */
export type UserStatus = "Active" | "Inactive" | "Pending";

/** System user record - can be assigned a role for access control. */
export interface AppUser extends AuditFields {
  id: string;
  name: string;
  email: string;
  /** Hashed; never returned in API responses. */
  password?: string;
  user_type: UserType;
  /** ObjectId string of the assigned role. */
  role_id?: string;
  /** Populated role name (virtual join). */
  role_name?: string;
  status: UserStatus;
  /** False for system-seeded users that must not be deleted. */
  can_delete?: boolean;
  /** True for trusted accounts (system admin, manually verified). */
  verified?: boolean;
}
