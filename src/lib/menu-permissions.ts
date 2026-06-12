/**
 * Permission catalogue. Two layers:
 *
 *   1. Menu nodes — top-level / second-level entries that drive the
 *      sidebar (their `id` is what `Sidebar.tsx` matches against).
 *   2. Action nodes — leaf children that gate individual API actions
 *      (create / update / delete / toggle / etc.).
 *
 * The whole tree is seeded into the `permissions` collection so the
 * Roles UI can render checkboxes for every grant. The tree is also the
 * authoritative source for the migration step in `scripts/seed.ts` that
 * expands legacy parent-only grants into "parent + all children" so
 * existing roles keep working after action-level guards land.
 */

export interface MenuPermissionNode {
  id: string;
  label: string;
  children?: MenuPermissionNode[];
}

/** Full permission tree — menu nodes plus per-action leaves. */
export const MENU_PERMISSION_TREE: MenuPermissionNode[] = [
  { id: "dashboard", label: "Dashboard" },
  {
    id: "today",
    label: "Today's Tasks",
    children: [
      { id: "today.complete", label: "Mark complete / Reopen" },
    ],
  },
  {
    id: "tasks",
    label: "Task Management",
    children: [
      {
        id: "tasks.all",
        label: "All Tasks",
        children: [
          { id: "tasks.all.create", label: "Create task" },
          { id: "tasks.all.update", label: "Update task" },
          { id: "tasks.all.delete", label: "Delete task" },
          { id: "tasks.all.toggle", label: "Activate / Deactivate" },
        ],
      },
      { id: "tasks.calendar", label: "Task Calendar" },
    ],
  },
  {
    id: "planner",
    label: "Planner",
    children: [
      { id: "planner.create", label: "Create planner block" },
      { id: "planner.update", label: "Update planner block" },
      { id: "planner.delete", label: "Delete planner block" },
      { id: "planner.complete", label: "Mark complete / Reopen" },
    ],
  },
  {
    id: "projects",
    label: "Project Management",
    children: [
      {
        id: "projects.boards",
        label: "Boards",
        children: [
          { id: "projects.boards.create", label: "Create board" },
          { id: "projects.boards.update", label: "Update board" },
          { id: "projects.boards.delete", label: "Delete / archive board" },
          { id: "projects.boards.duplicate", label: "Duplicate board" },
        ],
      },
      { id: "projects.my_tasks", label: "My Tasks" },
      { id: "projects.calendar", label: "Calendar" },
      {
        id: "projects.members",
        label: "Members / Team",
        children: [
          { id: "projects.members.invite", label: "Invite member" },
          { id: "projects.members.remove", label: "Remove member" },
        ],
      },
      { id: "projects.labels", label: "Labels" },
      { id: "projects.archived", label: "Archived Items" },
      { id: "projects.settings", label: "Project settings" },
    ],
  },
  {
    id: "users",
    label: "Users",
    children: [
      { id: "users.create", label: "Create user" },
      { id: "users.update", label: "Update user" },
      { id: "users.delete", label: "Delete user" },
    ],
  },
  {
    id: "roles",
    label: "Roles & Permissions",
    children: [
      { id: "roles.create", label: "Create role" },
      { id: "roles.update", label: "Update role" },
      { id: "roles.delete", label: "Delete role" },
      { id: "roles.assign", label: "Assign permissions" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    children: [
      { id: "settings.update", label: "Update settings" },
      { id: "settings.backup", label: "Backup / restore database" },
      { id: "settings.upload", label: "Upload assets" },
      { id: "settings.email_test", label: "Send test email" },
    ],
  },
];

/** Collects all permission ids from the tree (flattened). */
export function getAllPermissionIds(nodes: MenuPermissionNode[]): string[] {
  const ids: string[] = [];
  function walk(items: MenuPermissionNode[]) {
    for (const node of items) {
      ids.push(node.id);
      if (node.children?.length) walk(node.children);
    }
  }
  walk(nodes);
  return ids;
}

/** Build parentId → directChildIds map (used by the seeder migration). */
export function getDirectChildrenMap(
  nodes: MenuPermissionNode[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  function walk(items: MenuPermissionNode[]) {
    for (const node of items) {
      if (node.children?.length) {
        map.set(
          node.id,
          node.children.map((c) => c.id),
        );
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return map;
}

/**
 * Walk up the dotted hierarchy: "tasks.all.create" → ["tasks.all", "tasks"].
 * Used by `requirePermission` so an explicitly-granted ancestor can satisfy
 * a descendant action check (helps roles that only grant the parent).
 */
export function ancestorsOf(permissionId: string): string[] {
  const ancestors: string[] = [];
  let cursor = permissionId;
  while (cursor.includes(".")) {
    cursor = cursor.substring(0, cursor.lastIndexOf("."));
    ancestors.push(cursor);
  }
  return ancestors;
}
