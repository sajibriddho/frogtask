"use client";

/**
 * Dashboard — productivity home for the signed-in user.
 *
 * Pulls live data from:
 *   GET /api/task-instances/today    — today's task list + statuses
 *   GET /api/task-instances/calendar — next 7 days for the upcoming widget
 *
 * Uses the existing TaskFormModal (from the All Tasks page) for the
 * inline "+ New Task" CTA, so create flows stay consistent everywhere.
 */

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Plus,
  ListChecks,
  CheckCircle2,
  Clock,
  CalendarDays,
  ArrowRight,
  Sparkles,
  Sun,
  CalendarRange,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskFormModal } from "@/app/tasks/_components/TaskFormModal";
import { ManageTagsModal } from "@/app/tasks/_components/ManageTagsModal";
import type {
  TaskPriority,
  CalendarBucket,
  TodayTask,
} from "@/types/task";
import type { TaskTag } from "@/types/task-tag";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-emerald-500",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

const SCHEDULE_LABEL: Record<TodayTask["schedule_type"], string> = {
  date_specific: "One-off",
  daily: "Daily",
  weekly: "Weekly",
};

function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { has, hasMenu } = usePermissions();

  const canCreateTask = has("tasks.all.create");
  const canCompleteToday = has("today.complete");
  const canSeeToday = hasMenu("today");
  const canSeeCalendar = hasMenu("tasks.calendar");

  const [today, setToday] = React.useState<TodayTask[]>([]);
  const [todayLoading, setTodayLoading] = React.useState(true);
  const [upcoming, setUpcoming] = React.useState<CalendarBucket[]>([]);
  const [upcomingLoading, setUpcomingLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [manageTagsOpen, setManageTagsOpen] = React.useState(false);
  const [tags, setTags] = React.useState<TaskTag[]>([]);
  const [verified, setVerified] = React.useState<boolean | null>(null);

  const fetchTags = React.useCallback(async () => {
    if (!canCreateTask) return;
    try {
      const res = await fetch("/api/task-tags", { cache: "no-store" });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: TaskTag[];
        error?: string;
      }>(res);
      if (json.success) setTags(json.data ?? []);
    } catch (err) {
      console.error("dashboard fetchTags", err);
    }
  }, [canCreateTask]);

  React.useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await parseJsonSafe<{
          success: boolean;
          data?: { verified?: boolean };
        }>(res);
        if (!cancelled && json.success) setVerified(!!json.data?.verified);
      } catch {
        /* silent — verified icon falls back to unverified */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchToday = React.useCallback(async () => {
    if (!canSeeToday) {
      setTodayLoading(false);
      return;
    }
    setTodayLoading(true);
    try {
      const res = await fetch("/api/task-instances/today", { cache: "no-store" });
      const json = await parseJsonSafe<{
        success: boolean;
        data: TodayTask[];
        error?: string;
      }>(res);
      if (json.success) setToday(json.data ?? []);
    } catch {
      /* silent — dashboard is best-effort */
    } finally {
      setTodayLoading(false);
    }
  }, [canSeeToday]);

  const fetchUpcoming = React.useCallback(async () => {
    if (!canSeeCalendar) {
      setUpcomingLoading(false);
      return;
    }
    setUpcomingLoading(true);
    try {
      const start = startOfTodayUtc();
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      const res = await fetch(
        `/api/task-instances/calendar?from=${isoDay(start)}&to=${isoDay(end)}`,
        { cache: "no-store" },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data: CalendarBucket[];
        error?: string;
      }>(res);
      if (json.success) setUpcoming(json.data ?? []);
    } catch {
      /* silent */
    } finally {
      setUpcomingLoading(false);
    }
  }, [canSeeCalendar]);

  React.useEffect(() => {
    fetchToday();
    fetchUpcoming();
  }, [fetchToday, fetchUpcoming]);

  // ── Counts ─────────────────────────────────────────────────────────
  const counts = React.useMemo(() => {
    let pending = 0;
    let completed = 0;
    for (const t of today) {
      if (t.instance?.status === "completed") completed++;
      else pending++;
    }
    return { total: today.length, pending, completed };
  }, [today]);

  const upcomingCount = React.useMemo(() => {
    const todayIso = isoDay(startOfTodayUtc());
    let total = 0;
    for (const b of upcoming) {
      if (b.date === todayIso) continue; // exclude today; we already show it
      total += b.tasks.length;
    }
    return total;
  }, [upcoming]);

  // ── Greeting ───────────────────────────────────────────────────────
  const fullName = session?.user?.name ?? "there";
  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);
  const todayLabel = React.useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  // ── Quick complete from dashboard ──────────────────────────────────
  const toggleComplete = async (item: TodayTask) => {
    if (!item.instance || !canCompleteToday) return;
    const next =
      item.instance.status === "completed" ? "pending" : "completed";
    try {
      const res = await fetch(`/api/task-instances/${item.instance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to update task");
        return;
      }
      toast.success(
        next === "completed" ? "Task completed" : "Task reopened",
      );
      fetchToday();
    } catch {
      toast.error("Failed to update task");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Hero / greeting */}
      <Card className="border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-7">
          <div className="flex items-start gap-4 min-w-0">
            <span className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                <span className="truncate">
                  {greeting}, {fullName}
                </span>
                {verified !== null &&
                  (verified ? (
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
                  ))}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {todayLabel}
                {counts.pending > 0 ? (
                  <>
                    {" · "}
                    <span className="text-foreground font-medium">
                      {counts.pending} pending today
                    </span>
                  </>
                ) : counts.total > 0 ? (
                  <>
                    {" · "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      All caught up!
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canSeeToday && (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/today">
                  <Sun className="mr-2 h-4 w-4" />
                  Today&apos;s view
                </Link>
              </Button>
            )}
            {canCreateTask && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="rounded-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                New task
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={ListChecks}
          tone="primary"
          label="Today total"
          value={counts.total}
          href={canSeeToday ? "/today" : undefined}
          loading={todayLoading}
        />
        <StatCard
          icon={Clock}
          tone="amber"
          label="Pending today"
          value={counts.pending}
          href={canSeeToday ? "/today" : undefined}
          loading={todayLoading}
        />
        <StatCard
          icon={CheckCircle2}
          tone="emerald"
          label="Completed today"
          value={counts.completed}
          href={canSeeToday ? "/today" : undefined}
          loading={todayLoading}
        />
        <StatCard
          icon={CalendarDays}
          tone="sky"
          label="Upcoming (7d)"
          value={upcomingCount}
          href={canSeeCalendar ? "/tasks/calendar" : undefined}
          loading={upcomingLoading}
        />
      </div>

      {/* Two-column body */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today preview */}
        <Card className="lg:col-span-2 border-border">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Today&apos;s tasks
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Knock these out and you&apos;re done for the day.
                </p>
              </div>
              {canSeeToday && (
                <Link
                  href="/today"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {todayLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-muted/40 animate-pulse"
                  />
                ))}
              </div>
            ) : today.length === 0 ? (
              <EmptyTodayInline canCreate={canCreateTask} onCreate={() => setCreateOpen(true)} />
            ) : (
              <ul className="divide-y divide-border">
                {today.slice(0, 6).map((item) => {
                  const completed = item.instance?.status === "completed";
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={completed}
                          disabled={!canCompleteToday}
                          onCheckedChange={() => toggleComplete(item)}
                          aria-label={
                            completed ? "Reopen task" : "Mark task complete"
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p
                            className={cn(
                              "text-sm font-medium text-foreground",
                              completed && "line-through text-muted-foreground",
                            )}
                          >
                            {item.title}
                          </p>
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              PRIORITY_DOT[item.priority],
                            )}
                            aria-label={`Priority ${item.priority}`}
                          />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange className="h-3 w-3" />
                            {SCHEDULE_LABEL[item.schedule_type]}
                          </span>
                          {item.reminder_time && (
                            <>
                              <span aria-hidden>·</span>
                              <span>⏰ {item.reminder_time}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {today.length > 6 && canSeeToday && (
                  <li className="px-5 py-3 text-center">
                    <Link
                      href="/today"
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      + {today.length - 6} more in Today
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming this week */}
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Upcoming
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Next 7 days.
                </p>
              </div>
              {canSeeCalendar && (
                <Link
                  href="/tasks/calendar"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Calendar
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {upcomingLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl bg-muted/40 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <UpcomingList buckets={upcoming} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inline task create modal */}
      {canCreateTask && (
        <>
          <TaskFormModal
            open={createOpen}
            onOpenChange={setCreateOpen}
            task={null}
            tags={tags}
            onManageTags={() => setManageTagsOpen(true)}
            onSaved={() => {
              setCreateOpen(false);
              fetchToday();
              fetchUpcoming();
            }}
          />
          <ManageTagsModal
            open={manageTagsOpen}
            onOpenChange={setManageTagsOpen}
            onChanged={fetchTags}
          />
        </>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  href,
  loading,
}: {
  icon: React.ElementType;
  tone: "primary" | "amber" | "emerald" | "sky";
  label: string;
  value: number;
  href?: string;
  loading?: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  };
  const inner = (
    <div className="flex items-center gap-3 sm:gap-4">
      <span
        className={cn(
          "flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl",
          tones[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <div className="mt-1 h-7 w-12 rounded-md bg-muted/60 animate-pulse" />
        ) : (
          <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none mt-1 text-foreground">
            {value}
          </p>
        )}
      </div>
    </div>
  );
  return (
    <Card
      className={cn(
        "border-border transition-all",
        href && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
      )}
    >
      <CardContent className="p-4 sm:p-5">
        {href ? <Link href={href}>{inner}</Link> : inner}
      </CardContent>
    </Card>
  );
}

function EmptyTodayInline({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
        <CheckCircle2 className="h-6 w-6" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">
        Nothing scheduled today
      </h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        You&apos;re all clear. Add a task to plan your day.
      </p>
      {canCreate && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={onCreate}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New task
        </Button>
      )}
    </div>
  );
}

function UpcomingList({ buckets }: { buckets: CalendarBucket[] }) {
  const todayIso = isoDay(startOfTodayUtc());
  const future = buckets
    .filter((b) => b.date > todayIso && b.tasks.length > 0)
    .slice(0, 7);

  if (future.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
          <CalendarDays className="h-6 w-6" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">Clear week ahead</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Nothing scheduled for the next 7 days.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {future.map((b) => {
        const date = new Date(`${b.date}T00:00:00Z`);
        const weekday = date.toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        });
        const day = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
        return (
          <li
            key={b.date}
            className="flex items-center gap-3 px-5 py-3"
          >
            <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted px-2 py-1.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {weekday}
              </span>
              <span className="text-sm font-bold tabular-nums text-foreground leading-tight">
                {day.split(" ")[1]}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {b.tasks.length} {b.tasks.length === 1 ? "task" : "tasks"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {b.tasks
                  .slice(0, 2)
                  .map((t) => t.title)
                  .join(" · ")}
                {b.tasks.length > 2 ? ` · +${b.tasks.length - 2} more` : ""}
              </p>
            </div>
            <div className="flex -space-x-1.5 shrink-0">
              {b.tasks.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className={cn(
                    "h-2 w-2 rounded-full ring-2 ring-card",
                    PRIORITY_DOT[t.priority],
                  )}
                  aria-hidden
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
