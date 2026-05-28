"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MasterBreadcrumb } from "@/components/layout/MasterBreadcrumb";
import { DigitalClock } from "@/components/layout/DigitalClock";
import { parseJsonSafe } from "@/lib/api";

interface TopbarProps {
  title: string;
  onMobileMenuClick?: () => void;
  showMobileMenu?: boolean;
}

interface ProfileSummary {
  role_name?: string;
  user_type?: string;
  profile_photo?: string;
}

function initialsOf(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function Topbar({
  title,
  onMobileMenuClick,
  showMobileMenu,
}: TopbarProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { theme, toggleTheme, mounted } = useTheme();
  const { hasMenu } = usePermissions();

  const [profile, setProfile] = React.useState<ProfileSummary | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);

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
        /* silent — avatar falls back to session data */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

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
  const canAccessSettings = hasMenu("settings");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b border-border bg-card/50 backdrop-blur-lg px-3 sm:px-6 shadow-sm">
      {showMobileMenu && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuClick}
          aria-label="Open menu"
          className="h-10 w-10 shrink-0 lg:hidden hover:bg-primary/10 hover:text-primary"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <div className="flex flex-1 flex-col justify-center gap-0.5 min-w-0">
        <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
          {title}
        </h1>
        <div className="hidden sm:block">
          <MasterBreadcrumb />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
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

        <DigitalClock />

        <div className="h-8 w-px bg-border hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-primary/20 transition-all"
              aria-label="Open user menu"
            >
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} /> : null}
                <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="avatar-status-dot"></div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 card-shadow-lg">
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
                  <p className="text-sm font-semibold truncate">{name}</p>
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
            <DropdownMenuItem asChild className="cursor-pointer menu-item-hover">
              <Link href="/profile">
                <User className="mr-2 h-4 w-4" />
                View Profile
              </Link>
            </DropdownMenuItem>
            {canAccessSettings && (
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
      </div>
    </header>
  );
}
