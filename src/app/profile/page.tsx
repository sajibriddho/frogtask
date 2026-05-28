"use client";

/**
 * Profile page — shows the logged-in user's details, allows updates to
 * name / email, and hosts a separate card for password change.
 *
 * Layout: a gradient hero banner with the avatar overlay, a four-tile
 * stats strip (role / status / member since / last updated), then the
 * account-info and security cards stacked.
 *
 * APIs:
 *   GET  /api/profile          → load user + role
 *   PUT  /api/profile          → update name / email
 *   POST /api/profile/password → change password
 */

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  User as UserIcon,
  Mail,
  Shield,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Save,
  Calendar,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  RotateCw,
  IdCard,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  name: string;
  email: string;
  user_type: string;
  status: "Active" | "Inactive";
  role_name: string;
  profile_photo: string;
  created_at: string | null;
  updated_at: string | null;
  verified?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function initialsOf(name: string | undefined | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function fmtDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtDateTime(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(months / 12);
  return `${years} yr${years === 1 ? "" : "s"} ago`;
}

// ── Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { status, update: updateSession } = useSession();

  const [data, setData] = React.useState<ProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ProfileData;
        error?: string;
      }>(res);
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setErr(json.error || "Failed to load profile");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  if (loading || status === "loading") {
    return <ProfileSkeleton />;
  }

  if (err) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load profile</AlertTitle>
        <AlertDescription>{err}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <ProfileHero data={data} />
      <ProfileStats data={data} />
      <AccountInfoCard
        data={data}
        onSaved={(next) => {
          setData(next);
          // Keep the NextAuth session in sync so the topbar avatar /
          // greeting picks up name + email changes without a reload.
          void updateSession({ name: next.name, email: next.email });
        }}
      />
      <PasswordCard />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────

function ProfileHero({ data }: { data: ProfileData }) {
  const initials = initialsOf(data.name);
  const isActive = data.status === "Active";

  return (
    <Card className="relative overflow-hidden border-border">
      {/* Soft ambient gradient washes — much subtler than a full banner. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-secondary/10 blur-3xl"
      />

      <CardContent className="relative flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
        {/* Avatar with a thin gradient ring + status dot */}
        <div className="relative shrink-0">
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary to-secondary opacity-60 blur-[2px]"
          />
          <Avatar className="relative h-20 w-20 border-2 border-card shadow-md ring-1 ring-border sm:h-24 sm:w-24">
            {data.profile_photo ? (
              <AvatarImage src={data.profile_photo} alt={data.name} />
            ) : null}
            <AvatarFallback className="bg-linear-to-br from-primary to-secondary text-white text-2xl font-semibold sm:text-3xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Live status dot, anchored bottom-right of the avatar */}
          <span
            aria-hidden
            title={data.status}
            className={cn(
              "absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card",
              isActive ? "bg-emerald-500" : "bg-muted-foreground",
            )}
          >
            {isActive && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
            )}
          </span>
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Profile
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                isActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-muted-foreground",
                )}
              />
              {data.status}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px] leading-tight">
              {data.name}
            </h1>
            {data.verified ? (
              <span
                title="Verified account"
                aria-label="Verified account"
                className="inline-flex items-center text-sky-600 dark:text-sky-400"
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
            ) : (
              <span
                title="Unverified account"
                aria-label="Unverified account"
                className="inline-flex items-center text-muted-foreground"
              >
                <ShieldAlert className="h-5 w-5" />
              </span>
            )}
          </div>

          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {data.email}
          </p>

          {/* Inline meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">
                {data.role_name || "—"}
              </span>
            </span>
            {data.user_type && (
              <>
                <span aria-hidden className="text-border">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <IdCard className="h-3.5 w-3.5" />
                  {data.user_type} account
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* Bottom accent — thin gradient hairline */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
    </Card>
  );
}

// ── Stats strip ─────────────────────────────────────────────────────────

function ProfileStats({ data }: { data: ProfileData }) {
  const isActive = data.status === "Active";

  const tiles = [
    {
      icon: Shield,
      label: "Role",
      value: data.role_name || "—",
      tone: "primary" as const,
    },
    {
      icon: isActive ? ShieldCheck : ShieldAlert,
      label: "Status",
      value: data.status,
      tone: isActive ? ("emerald" as const) : ("muted" as const),
    },
    {
      icon: Calendar,
      label: "Member since",
      value: fmtDate(data.created_at),
      hint: relativeTime(data.created_at),
      tone: "sky" as const,
    },
    {
      icon: RotateCw,
      label: "Last updated",
      value: fmtDateTime(data.updated_at),
      hint: relativeTime(data.updated_at),
      tone: "violet" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "emerald" | "muted" | "sky" | "violet";
}) {
  const tones: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    muted: "bg-muted text-muted-foreground",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  };
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className="mt-0.5 truncate text-sm font-semibold text-foreground"
            title={value}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Account Info editable card ──────────────────────────────────────────

function AccountInfoCard({
  data,
  onSaved,
}: {
  data: ProfileData;
  onSaved: (next: ProfileData) => void;
}) {
  const [name, setName] = React.useState(data.name);
  const [email, setEmail] = React.useState(data.email);
  const [saving, setSaving] = React.useState(false);

  // Sync form state when the parent reloads fresh data.
  React.useEffect(() => {
    setName(data.name);
    setEmail(data.email);
  }, [data]);

  const dirty =
    name.trim() !== data.name || email.trim().toLowerCase() !== data.email;

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ProfileData;
        error?: string;
      }>(res);
      if (json.success && json.data) {
        onSaved(json.data);
        toast.success("Profile updated");
      } else {
        toast.error(json.error || "Failed to update profile");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">Account information</CardTitle>
            <CardDescription className="text-xs">
              Update the name and email address tied to your account.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="profile_name" className="text-xs font-medium">
              Full name
            </Label>
            <Input
              id="profile_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="profile_email" className="text-xs font-medium">
              Email address
            </Label>
            <Input
              id="profile_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>
        </div>

        {dirty && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            You have unsaved changes
          </p>
        )}
      </CardContent>
      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3 sm:px-6">
        <Button
          variant="outline"
          onClick={() => {
            setName(data.name);
            setEmail(data.email);
          }}
          disabled={!dirty || saving}
          className="rounded-xl"
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-xl"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save changes
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

// ── Password card ──────────────────────────────────────────────────────

function PasswordCard() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNext, setShowNext] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const mismatched = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const sameAsCurrent =
    current.length > 0 && next.length > 0 && next === current;
  const ready =
    current.length > 0 &&
    next.length >= 8 &&
    confirm === next &&
    next !== current;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const handleSubmit = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          confirmPassword: confirm,
        }),
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (json.success) {
        reset();
        toast.success("Password changed");
      } else {
        toast.error(json.error || "Failed to change password");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  // Strength meter (0–4) — same heuristics as the register page.
  const strength = (() => {
    let s = 0;
    if (next.length >= 8) s++;
    if (/[A-Za-z]/.test(next)) s++;
    if (/\d/.test(next)) s++;
    if (/[^A-Za-z0-9]/.test(next)) s++;
    return s;
  })();
  const strengthColor =
    strength <= 1
      ? "bg-destructive"
      : strength === 2
        ? "bg-amber-500"
        : strength === 3
          ? "bg-primary"
          : "bg-emerald-500";
  const strengthLabel =
    next.length === 0
      ? ""
      : strength <= 1
        ? "Weak"
        : strength === 2
          ? "Fair"
          : strength === 3
            ? "Good"
            : "Strong";

  return (
    <Card className="border-border">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">Security</CardTitle>
            <CardDescription className="text-xs">
              Use at least 8 characters. A mix of letters, numbers and
              symbols makes a strong password.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <PasswordField
          id="current_password"
          label="Current password"
          value={current}
          show={showCurrent}
          onChange={setCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
          autoComplete="current-password"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <PasswordField
            id="new_password"
            label="New password"
            value={next}
            show={showNext}
            onChange={setNext}
            onToggle={() => setShowNext((v) => !v)}
            autoComplete="new-password"
            hint={
              tooShort
                ? "Must be at least 8 characters."
                : sameAsCurrent
                  ? "New password must differ from your current one."
                  : undefined
            }
            hintTone={tooShort || sameAsCurrent ? "error" : undefined}
          />
          <PasswordField
            id="confirm_password"
            label="Confirm new password"
            value={confirm}
            show={showConfirm}
            onChange={setConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            autoComplete="new-password"
            hint={
              mismatched
                ? "Passwords do not match."
                : confirm.length > 0 && next === confirm
                  ? "Passwords match."
                  : undefined
            }
            hintTone={
              mismatched
                ? "error"
                : confirm.length > 0
                  ? "success"
                  : undefined
            }
          />
        </div>

        {/* Strength meter */}
        {next.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Password strength
              </span>
              <span className="text-[11px] font-semibold text-foreground">
                {strengthLabel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full bg-muted transition-colors",
                    i < strength && strengthColor,
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3 sm:px-6">
        <Button
          variant="outline"
          onClick={reset}
          disabled={saving || (!current && !next && !confirm)}
          className="rounded-xl"
        >
          Clear
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!ready || saving}
          className="rounded-xl"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Update password
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  value,
  show,
  onChange,
  onToggle,
  autoComplete,
  hint,
  hintTone,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
  autoComplete?: string;
  hint?: string;
  hintTone?: "error" | "success";
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && (
        <p
          className={cn(
            "text-xs",
            hintTone === "error"
              ? "text-destructive"
              : hintTone === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Card>
        <CardContent className="flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
          <Skeleton className="h-20 w-20 rounded-full sm:h-24 sm:w-24 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-3 p-4 sm:p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-1 h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
