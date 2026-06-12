"use client";

/**
 * TopNav — single sticky header that drives the whole authenticated app.
 *
 * Replaces the previous sidebar + topbar split. Productivity items
 * (Dashboard / Today / All Tasks / Task Calendar) live as primary tabs.
 * Admin / system entries (Users, Roles, Settings) are folded into the
 * user dropdown so they don't dominate the chrome.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Sun,
  ListChecks,
  CalendarDays,
  User,
  Settings,
  LogOut,
  Moon,
  Menu,
  X,
  Loader2,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

import { FrogIcon } from "@/components/icons/FrogIcon";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { useBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  permissionId?: string;
}

// Primary tabs in the top bar.
const PRIMARY_NAV: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutGrid,
    permissionId: "dashboard",
  },
  {
    title: "Today",
    href: "/today",
    icon: Sun,
    permissionId: "today",
  },
  {
    title: "All Tasks",
    href: "/tasks",
    icon: ListChecks,
    permissionId: "tasks.all",
  },
  {
    title: "Calendar",
    href: "/tasks/calendar",
    icon: CalendarDays,
    permissionId: "tasks.calendar",
  },
  {
    title: "Planner",
    href: "/planner",
    icon: Sparkles,
    permissionId: "planner",
  },
];

interface ProfileSummary {
  role_name?: string;
  user_type?: string;
  profile_photo?: string;
  verified?: boolean;
}

function initialsOf(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/** Pick the deepest item whose href matches — `/tasks/calendar` shouldn't light up `/tasks`. */
function pickActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best;
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { data: session, status } = useSession();
  const { theme, toggleTheme, mounted } = useTheme();
  const { companyName, companyLogo } = useBranding();
  const { hasMenu, loading: permissionsLoading } = usePermissions();

  const [profile, setProfile] = React.useState<ProfileSummary | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (status !== "authenticated") {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await parseJsonSafe<{
          success: boolean;
          data?: ProfileSummary;
        }>(res);
        if (!cancelled && json.success && json.data) setProfile(json.data);
      } catch {
        /* avatar falls back to session data */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Close the mobile drawer on route change.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const visibleNav = React.useMemo(() => {
    if (permissionsLoading) return [];
    return PRIMARY_NAV.filter(
      (item) => !item.permissionId || hasMenu(item.permissionId),
    );
  }, [hasMenu, permissionsLoading]);

  const activeHref = React.useMemo(
    () =>
      pickActiveHref(
        pathname,
        visibleNav.map((i) => i.href),
      ),
    [pathname, visibleNav],
  );

  const canManageUsers = hasMenu("users");
  const canManageRoles = hasMenu("roles");
  const canManageSettings = hasMenu("settings");
  const hasAdminItems = canManageUsers || canManageRoles || canManageSettings;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const user = session?.user;
  const name = user?.name ?? "Guest";
  const email = user?.email ?? "";
  const initials = initialsOf(user?.name ?? undefined);
  const roleLabel =
    profile?.role_name && profile.role_name !== "—"
      ? profile.role_name
      : (profile?.user_type ?? user?.user_type ?? "Member");
  const avatarSrc =
    profile?.profile_photo ||
    (user as { image?: string } | undefined)?.image ||
    "";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg shadow-sm">
        <div className="mx-auto flex h-16 max-w-(--breakpoint-2xl) items-center gap-3 px-3 sm:px-6">
          {/* Brand — clicking either the logo or the company name goes
              to the dashboard. Dashboard is intentionally not in the
              primary nav row; the logo is the affordance. */}
          <Link
            href="/dashboard"
            title="Go to dashboard"
            aria-label="Go to dashboard"
            className="flex items-center gap-2.5 shrink-0 group rounded-xl px-1 -mx-1 hover:bg-muted/60 transition-colors"
          >
            {companyLogo ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-full w-full object-contain"
                />
              </span>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm shadow-primary/20 transition-transform group-hover:scale-105">
                <FrogIcon className="h-4 w-4" strokeWidth={2.5} />
              </span>
            )}
            <span
              className="hidden sm:block max-w-[160px] truncate text-base font-bold tracking-tight text-foreground"
              title={companyName}
            >
              {companyName}
            </span>
          </Link>

          {/* Primary nav (desktop) */}
          <nav className="hidden lg:flex flex-1 items-center justify-center">
            <ul className="flex items-center gap-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeHref === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Spacer to push right cluster on tablet */}
          <div className="flex-1 lg:hidden" />

          {/* Right cluster */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="h-10 w-10 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-primary/20 transition-all"
                  aria-label="Open user menu"
                >
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    {avatarSrc ? (
                      <AvatarImage src={avatarSrc} alt={name} />
                    ) : null}
                    <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[calc(100vw-1rem)] max-w-xs sm:w-64 card-shadow-lg"
              >
                <DropdownMenuLabel>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-primary/20">
                      {avatarSrc ? (
                        <AvatarImage src={avatarSrc} alt={name} />
                      ) : null}
                      <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white text-sm font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{name}</p>
                        {profile?.verified ? (
                          <span
                            title="Verified account"
                            aria-label="Verified account"
                            className="inline-flex items-center text-sky-600 dark:text-sky-400"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span
                            title="Unverified account"
                            aria-label="Unverified account"
                            className="inline-flex items-center text-muted-foreground"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {email}
                      </p>
                      <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer menu-item-hover"
                >
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    View Profile
                  </Link>
                </DropdownMenuItem>

                {hasAdminItems && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Administration
                    </DropdownMenuLabel>
                    {canManageUsers && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer menu-item-hover"
                      >
                        <Link href="/users">
                          <Users className="mr-2 h-4 w-4" />
                          Users
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canManageRoles && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer menu-item-hover"
                      >
                        <Link href="/roles">
                          <Shield className="mr-2 h-4 w-4" />
                          Roles &amp; Permissions
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canManageSettings && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer menu-item-hover"
                      >
                        <Link href="/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleLogout();
                  }}
                  disabled={loggingOut}
                  className="cursor-pointer hover:bg-destructive/10 text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  {loggingOut ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-4 w-4" />
                  )}
                  {loggingOut ? "Logging out…" : "Log out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="h-10 w-10 lg:hidden hover:bg-primary/10 hover:text-primary"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="fixed left-0 right-0 top-16 z-40 border-b border-border bg-card shadow-xl lg:hidden">
            <nav className="px-3 py-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
