/**
 * Breadcrumb configuration.
 *
 * `getBreadcrumbSegments(pathname)` returns the ordered list of segments
 * rendered by the <MasterBreadcrumb /> component. Every page in the app
 * should map to at least one segment so users always have a sense of
 * where they are in the navigation hierarchy.
 *
 * Resolvers run in order; the first one that claims the pathname wins.
 * A resolver returning `null` means "not mine, try the next".
 */

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

type Resolver = (pathname: string) => BreadcrumbSegment[] | null;

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function exact(
  pathname: string,
  routes: Record<string, BreadcrumbSegment[]>,
): BreadcrumbSegment[] | null {
  return routes[pathname] ?? null;
}

/** True when `pathname` is `prefix` or a descendant of it. */
function startsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

// ──────────────────────────────────────────────────────────────────────
// Module resolvers
// ──────────────────────────────────────────────────────────────────────

/** Dashboard / root-level standalone pages. */
const coreResolver: Resolver = (pathname) =>
  exact(pathname, {
    "/dashboard": [{ label: "Dashboard" }],
    "/profile": [{ label: "My Profile" }],
    "/settings": [{ label: "Settings" }],
    "/access-denied": [{ label: "Access denied" }],
  });

/** Users management. */
const usersResolver: Resolver = (pathname) => {
  if (!startsWith(pathname, "/users")) return null;
  return [{ label: "Users" }];
};

/** Roles & permissions. */
const rolesResolver: Resolver = (pathname) => {
  if (!startsWith(pathname, "/roles")) return null;
  if (pathname === "/roles") return [{ label: "Roles" }];
  if (pathname === "/roles/new") {
    return [{ label: "Roles", href: "/roles" }, { label: "New role" }];
  }
  // /roles/[id]
  return [{ label: "Roles", href: "/roles" }, { label: "Edit role" }];
};

/** Today's Tasks (top-level, separate from Task Management). */
const todayResolver: Resolver = (pathname) => {
  if (!startsWith(pathname, "/today")) return null;
  return [{ label: "Today's Tasks" }];
};

/** Task Management (parent group + children). */
const tasksResolver: Resolver = (pathname) => {
  if (!startsWith(pathname, "/tasks")) return null;
  if (pathname === "/tasks") {
    return [
      { label: "Task Management" },
      { label: "All Tasks" },
    ];
  }
  if (pathname === "/tasks/calendar") {
    return [
      { label: "Task Management" },
      { label: "Task Calendar" },
    ];
  }
  return [{ label: "Task Management" }];
};

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/** First resolver to return a non-null result wins. */
const RESOLVERS: Resolver[] = [
  coreResolver,
  todayResolver,
  tasksResolver,
  usersResolver,
  rolesResolver,
];

export function getBreadcrumbSegments(pathname: string): BreadcrumbSegment[] {
  if (!pathname) return [];
  for (const r of RESOLVERS) {
    const segments = r(pathname);
    if (segments) return segments;
  }
  return [];
}
