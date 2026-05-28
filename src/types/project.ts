/**
 * project.ts — shared TypeScript types for the Project Management module.
 *
 * The module is a Trello-inspired kanban built on top of seven Mongoose
 * collections (boards, board_members, board_lists, cards, labels,
 * checklists, comments, attachments, activity_logs). The shapes here
 * mirror those documents with `id` (string) instead of `_id` so the
 * client never has to know about Mongo specifics.
 */

export type BoardVisibility = "private" | "team" | "public";
export type BoardStatus = "active" | "archived";
export type BoardRole = "owner" | "admin" | "member" | "viewer";

export type CardPriority = "low" | "medium" | "high" | "urgent";

export interface AuditUser {
  id: string;
  name: string;
}

// ─── Boards ────────────────────────────────────────────────────────────

export interface Board {
  id: string;
  title: string;
  slug: string;
  description: string;
  visibility: BoardVisibility;
  background: string; // hex colour or gradient key
  is_favorite: boolean;
  status: BoardStatus;
  created_by: AuditUser;
  updated_by: AuditUser;
  // populated read-only counters from server
  list_count?: number;
  card_count?: number;
  member_count?: number;
  my_role?: BoardRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  role: BoardRole;
  joined_at: string;
}

// ─── Lists ────────────────────────────────────────────────────────────

export interface BoardList {
  id: string;
  board_id: string;
  title: string;
  position: number;
  is_archived: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Cards ────────────────────────────────────────────────────────────

export interface CardMember {
  user_id: string;
  user_name: string;
}

export interface CardLabelRef {
  label_id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  is_completed: boolean;
  assigned_to: string | null;
  due_date: string | null;
  position: number;
}

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  user_name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  card_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: AuditUser;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  board_id: string;
  card_id: string | null;
  user_id: string;
  user_name: string;
  action: string; // canonical action key, see ACTIVITY_ACTIONS
  description: string; // human-readable line
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  priority: CardPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  cover: string; // hex colour or empty
  is_archived: boolean;
  members: CardMember[];
  labels: CardLabelRef[];
  checklist_total?: number;
  checklist_done?: number;
  comment_count?: number;
  attachment_count?: number;
  created_by: AuditUser;
  updated_by: AuditUser;
  createdAt?: string;
  updatedAt?: string;
  /**
   * Client-only flag set on optimistic placeholder cards (e.g. while a
   * duplicate is being created on the server). Never sent over the wire.
   * KanbanCard renders these with a spinner overlay and disables drag.
   */
  _pending?: boolean;
}

// ─── Labels ───────────────────────────────────────────────────────────

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────

export const BOARD_BACKGROUNDS: Array<{
  key: string;
  label: string;
  preview: string;
}> = [
  {
    key: "emerald",
    label: "Emerald",
    preview: "linear-gradient(135deg,#059669,#10b981)",
  },
  {
    key: "ocean",
    label: "Ocean",
    preview: "linear-gradient(135deg,#0ea5e9,#6366f1)",
  },
  {
    key: "sunset",
    label: "Sunset",
    preview: "linear-gradient(135deg,#f97316,#ec4899)",
  },
  {
    key: "amber",
    label: "Amber",
    preview: "linear-gradient(135deg,#f59e0b,#dc2626)",
  },
  {
    key: "violet",
    label: "Violet",
    preview: "linear-gradient(135deg,#8b5cf6,#d946ef)",
  },
  {
    key: "slate",
    label: "Slate",
    preview: "linear-gradient(135deg,#475569,#0f172a)",
  },
  {
    key: "lime",
    label: "Lime",
    preview: "linear-gradient(135deg,#84cc16,#059669)",
  },
  {
    key: "rose",
    label: "Rose",
    preview: "linear-gradient(135deg,#f43f5e,#7c3aed)",
  },
];

export function backgroundFromKey(key: string): string {
  const match = BOARD_BACKGROUNDS.find((b) => b.key === key);
  return match?.preview ?? "linear-gradient(135deg,#059669,#10b981)";
}

export const LABEL_COLORS: string[] = [
  "#059669", // emerald
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#475569", // slate
];

export const PRIORITY_LABEL: Record<CardPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_DOT_CLASS: Record<CardPriority, string> = {
  low: "bg-emerald-500",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

export const PRIORITY_BADGE_CLASS: Record<CardPriority, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  urgent: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export const ROLE_LABEL: Record<BoardRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

/** Default lists seeded when a board is created. */
export const DEFAULT_LISTS = ["Backlog", "To Do", "In Progress", "Review", "Done"];

/** Canonical activity action keys (also shown to humans via description). */
export const ACTIVITY_ACTIONS = {
  BOARD_CREATED: "board.created",
  BOARD_UPDATED: "board.updated",
  BOARD_ARCHIVED: "board.archived",
  LIST_CREATED: "list.created",
  LIST_UPDATED: "list.updated",
  LIST_ARCHIVED: "list.archived",
  LIST_REORDERED: "list.reordered",
  CARD_CREATED: "card.created",
  CARD_UPDATED: "card.updated",
  CARD_MOVED: "card.moved",
  CARD_REORDERED: "card.reordered",
  CARD_ARCHIVED: "card.archived",
  CARD_DUPLICATED: "card.duplicated",
  MEMBER_ASSIGNED: "card.member.assigned",
  MEMBER_REMOVED: "card.member.removed",
  LABEL_ADDED: "card.label.added",
  LABEL_REMOVED: "card.label.removed",
  DUE_DATE_CHANGED: "card.due_date.changed",
  CHECKLIST_ADDED: "checklist.added",
  CHECKLIST_ITEM_TOGGLED: "checklist.item.toggled",
  COMMENT_ADDED: "card.comment.added",
  ATTACHMENT_UPLOADED: "card.attachment.uploaded",
} as const;
