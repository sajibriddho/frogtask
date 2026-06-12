"use client";

/**
 * Sidebar - main navigation layout component.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LayoutDashboard,
  Users,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Shield,
  LogOut,
  ListChecks,
  CalendarDays,
  Sun,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import { FrogIcon } from "@/components/icons/FrogIcon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useBranding } from "@/hooks/useBranding";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isDesktop?: boolean;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface MenuItem {
  title: string;
  icon: React.ElementType;
  href: string;
  permissionId?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Main Menu",
    items: [
      {
        title: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        permissionId: "dashboard",
      },
      {
        title: "Today's Tasks",
        icon: Sun,
        href: "/today",
        permissionId: "today",
      },
    ],
  },
  {
    label: "Task Management",
    items: [
      {
        title: "All Tasks",
        icon: ListChecks,
        href: "/tasks",
        permissionId: "tasks.all",
      },
      {
        title: "Task Calendar",
        icon: CalendarDays,
        href: "/tasks/calendar",
        permissionId: "tasks.calendar",
      },
      {
        title: "Planner",
        icon: Sparkles,
        href: "/planner",
        permissionId: "planner",
      },
    ],
  },
  {
    label: "Project Management",
    items: [
      {
        title: "Boards",
        icon: LayoutGrid,
        href: "/projects",
        permissionId: "projects.boards",
      },
      {
        title: "My Tasks",
        icon: ListChecks,
        href: "/projects/my-tasks",
        permissionId: "projects.my_tasks",
      },
      {
        title: "Project Calendar",
        icon: CalendarDays,
        href: "/projects/calendar",
        permissionId: "projects.calendar",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Users",
        icon: Users,
        href: "/users",
        permissionId: "users",
      },
      {
        title: "Roles",
        icon: Shield,
        href: "/roles",
        permissionId: "roles",
      },
      {
        title: "Settings",
        icon: Settings,
        href: "/settings",
        permissionId: "settings",
      },
    ],
  },
];

function SidebarMenuItem({
  item,
  isCollapsed,
  isActive,
}: {
  item: MenuItem;
  isCollapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "hover:bg-primary/10 hover:text-primary",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="flex-1">{item.title}</span>}
      </div>
    </Link>
  );
}

/**
 * Pick the deepest item whose href is a prefix of the current pathname.
 * Avoids "/tasks" lighting up when the user is on "/tasks/calendar"
 * — the longer match wins.
 */
function pickActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  isDesktop = true,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const effectiveCollapsed = isDesktop ? isCollapsed : false;
  const pathname = usePathname() ?? "/";
  const { companyName } = useBranding();
  const { loading: permissionsLoading, hasMenu } = usePermissions();
  const navRef = React.useRef<HTMLElement>(null);

  const filteredGroups = React.useMemo(() => {
    if (permissionsLoading) return [];
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.permissionId || hasMenu(item.permissionId),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [permissionsLoading, hasMenu]);

  const activeHref = React.useMemo(() => {
    const allHrefs = filteredGroups.flatMap((g) => g.items.map((i) => i.href));
    return pickActiveHref(pathname, allHrefs);
  }, [filteredGroups, pathname]);

  return (
    <aside
      style={{ width: effectiveCollapsed ? 80 : 280 }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-card shadow-sm transition-[width,transform] duration-300 ease-in-out",
        !isDesktop && "shadow-2xl",
        !isDesktop && !isMobileOpen && "-translate-x-full",
        !isDesktop && isMobileOpen && "translate-x-0",
      )}
      aria-hidden={!isDesktop && !isMobileOpen}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {!effectiveCollapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-md">
                <FrogIcon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span
                  className="block font-bold text-foreground text-lg truncate"
                  title={companyName}
                >
                  {companyName}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={isDesktop ? onToggle : onMobileClose}
            aria-label={isDesktop ? "Toggle sidebar" : "Close menu"}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {!isDesktop ? (
              <X className="h-5 w-5" />
            ) : isCollapsed ? (
              <Menu className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>

        <nav
          ref={navRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4"
        >
          {permissionsLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            filteredGroups.map((group, groupIndex) => (
              <div key={group.label} className="space-y-1">
                {!effectiveCollapsed && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((item, itemIndex) => (
                    <SidebarMenuItem
                      key={`${group.label}-${itemIndex}`}
                      item={item}
                      isCollapsed={effectiveCollapsed}
                      isActive={item.href === activeHref}
                    />
                  ))}
                </div>
                {!effectiveCollapsed &&
                  groupIndex < filteredGroups.length - 1 && (
                    <Separator className="my-2" />
                  )}
              </div>
            ))
          )}
        </nav>

        <div className="flex h-16 items-center border-t border-border px-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className={cn(
              "flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200",
              "bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground",
              effectiveCollapsed && "justify-center",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!effectiveCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
