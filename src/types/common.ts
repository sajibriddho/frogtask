/**
 * Common shared types used across all domain records.
 * Import from "@/types/common".
 */

/** Identifies the user who performed a create or update action. */
export interface AuditUser {
  id: string;
  name: string;
}

/** Audit trail fields shared by all documents. */
export interface AuditFields {
  created_by: AuditUser;
  created_at: Date;
  updated_by: AuditUser;
  updated_at: Date;
}
