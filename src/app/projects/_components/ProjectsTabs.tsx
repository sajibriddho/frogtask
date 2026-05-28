"use client";

/**
 * ProjectsTabs — secondary navigation that runs along the top of every
 * page in the Project Management module. Tabs are filtered against the
 * caller's menu permissions so we never link them to a 403.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  CheckSquare,
  Users,
  Tag,
  Archive,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

interface Tab {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
}

const TABS: Tab[] = [
  { href: "/projects", label: "Boards", icon: LayoutGrid, permission: "projects.boards" },
  {
    href: "/projects/my-tasks",
    label: "My Tasks",
    icon: CheckSquare,
    permission: "projects.my_tasks",
  },
  {
    href: "/projects/calendar",
    label: "Calendar",
    icon: CalendarDays,
    permission: "projects.calendar",
  },
  {
    href: "/projects/members",
    label: "Members",
    icon: Users,
    permission: "projects.members",
  },
  {
    href: "/projects/labels",
    label: "Labels",
    icon: Tag,
    permission: "projects.labels",
  },
  {
    href: "/projects/archived",
    label: "Archived",
    icon: Archive,
    permission: "projects.archived",
  },
  {
    href: "/projects/settings",
    label: "Settings",
    icon: Settings,
    permission: "projects.settings",
  },
];

/**
 * Sub-paths that are NOT board ids. Anything else under /projects/<x>
 * is treated as a board detail route (so the Boards tab lights up).
 *
 * We can't rely on a regex like /^\/projects\/[^/]+/ to detect "inside
 * a board" because /projects/my-tasks, /projects/calendar etc. also
 * match — that would incorrectly disable the My Tasks / Calendar /
 * Members / Labels / Archived / Settings tabs and would always light
 * up the Boards tab on those pages instead.
 */
const STATIC_TAB_PATHS = [
  "/projects/my-tasks",
  "/projects/calendar",
  "/projects/members",
  "/projects/labels",
  "/projects/archived",
  "/projects/settings",
];

/** Returns the matching static-tab path the caller is on, or null. */
function matchStaticTab(pathname: string): string | null {
  for (const t of STATIC_TAB_PATHS) {
    if (pathname === t || pathname.startsWith(t + "/")) return t;
  }
  return null;
}

export function ProjectsTabs() {
  const pathname = usePathname() ?? "";
  const { hasMenu, has } = usePermissions();

  const visible = TABS.filter(
    (t) => !t.permission || hasMenu(t.permission) || has(t.permission),
  );

  // Resolve once per render: which (if any) static tab are we under?
  // /projects        → null + isBoardsRoot=true
  // /projects/abc    → null + isBoardsRoot=true (board detail)
  // /projects/labels → "/projects/labels"
  const matchedStatic = matchStaticTab(pathname);
  const isInsideBoard =
    !matchedStatic && pathname.startsWith("/projects/") && pathname !== "/projects";
  const isBoardsRoot = pathname === "/projects" || isInsideBoard;

  return (
    <div className="-mx-3 sm:-mx-6 mb-4 border-b border-border bg-card/50 backdrop-blur supports-backdrop-filter:bg-card/30">
      <div className="flex items-center gap-0.5 overflow-x-auto px-3 sm:px-6 no-scrollbar">
        {visible.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.href === "/projects"
              ? isBoardsRoot
              : matchedStatic === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative inline-flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
