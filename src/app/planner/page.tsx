"use client";

/**
 * Planner — weekly time-blocked planner.
 *
 * The whole point of this module is *discipline*. Users plan their week
 * by dropping recurring time-blocks onto a Sun–Sat grid; each week the
 * page shows the same blocks plus a per-day completion tick. Completion
 * is per-date so a streak can be calculated and yesterday's blocks stay
 * marked done.
 *
 * The grid renders blocks as cards positioned by start_time within each
 * weekday column, similar to a calendar app. Tapping an empty area opens
 * the block modal seeded with that day + time; tapping a block opens it
 * in edit mode; the checkbox marks completion.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Flame,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toIsoDate, toUtcMidnight } from "@/lib/task-schedule";
import type {
  PlannerBlock,
  PlannerWeekBlock,
  PlannerWeekStats,
} from "@/types/planner";
import type { Weekday } from "@/types/task";

import { PlannerBlockModal } from "./_components/PlannerBlockModal";

// ─── Constants ─────────────────────────────────────────────────────────

const WEEKDAYS: Array<{ value: Weekday; label: string; short: string }> = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Render window: 6 AM (360) → 10 PM (1320). Blocks outside the window are
// still listed (clamped to the edges) so nothing is hidden.
const RENDER_START_MIN = 6 * 60;
const RENDER_END_MIN = 22 * 60;
const RENDER_MIN_RANGE = RENDER_END_MIN - RENDER_START_MIN;

const HOUR_LABELS: Array<{ min: number; label: string }> = [];
for (let h = 6; h <= 22; h += 2) {
  const lbl =
    h === 12
      ? "12 PM"
      : h < 12
        ? `${h} AM`
        : h === 24
          ? "12 AM"
          : `${h - 12} PM`;
  HOUR_LABELS.push({ min: h * 60, label: lbl });
}

const PRIORITY_RING: Record<string, string> = {
  low: "ring-emerald-300/60",
  medium: "ring-sky-300/60",
  high: "ring-rose-400/70",
};

// ─── Helpers ───────────────────────────────────────────────────────────

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour12} ${period}`
    : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function startOfWeek(d: Date): Date {
  const utc = toUtcMidnight(d)!;
  const dow = utc.getUTCDay();
  return new Date(utc.getTime() - dow * 86400000);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startFmt = start.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  const endFmt = end.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt} — ${endFmt}`;
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const { has, loading: permissionsLoading } = usePermissions();
  const canCreate = has("planner.create");
  const canUpdate = has("planner.update");
  const canDelete = has("planner.delete");
  const canComplete = has("planner.complete");

  const todayIso = React.useMemo(() => toIsoDate(new Date()), []);
  const [weekStart, setWeekStart] = React.useState<Date>(() =>
    startOfWeek(new Date()),
  );
  const [items, setItems] = React.useState<PlannerWeekBlock[]>([]);
  const [stats, setStats] = React.useState<PlannerWeekStats>({
    total: 0,
    completed: 0,
    upcoming: 0,
    current_streak: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlannerBlock | null>(null);
  const [seedWeekday, setSeedWeekday] = React.useState<Weekday>(1);
  const [seedStart, setSeedStart] = React.useState<string>("09:00");

  const fetchWeek = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/planner/week?start=${toIsoDate(weekStart)}`,
        { cache: "no-store" },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: {
          week_start: string;
          items: PlannerWeekBlock[];
          stats: PlannerWeekStats;
        };
        error?: string;
      }>(res);
      if (json.success && json.data) {
        setItems(json.data.items ?? []);
        setStats(
          json.data.stats ?? {
            total: 0,
            completed: 0,
            upcoming: 0,
            current_streak: 0,
          },
        );
      } else {
        toast.error(json.error || "Failed to load planner");
      }
    } catch (err) {
      console.error("fetchWeek", err);
      toast.error("Failed to load planner");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  React.useEffect(() => {
    if (!permissionsLoading) fetchWeek();
  }, [fetchWeek, permissionsLoading]);

  const itemsByWeekday = React.useMemo(() => {
    const map = new Map<Weekday, PlannerWeekBlock[]>();
    for (const wd of WEEKDAYS) map.set(wd.value, []);
    for (const it of items) {
      const list = map.get(it.weekday as Weekday) ?? [];
      list.push(it);
      map.set(it.weekday as Weekday, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
      map.set(k, list);
    }
    return map;
  }, [items]);

  const completionRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const openCreate = (weekday: Weekday, startTime = "09:00") => {
    if (!canCreate) {
      toast.error("You don't have permission to create planner blocks");
      return;
    }
    setEditing(null);
    setSeedWeekday(weekday);
    setSeedStart(startTime);
    setModalOpen(true);
  };

  const openEdit = (block: PlannerBlock) => {
    setEditing(block);
    setModalOpen(true);
  };

  const toggleCompletion = async (item: PlannerWeekBlock) => {
    if (!canComplete) {
      toast.error("You don't have permission to mark planner blocks");
      return;
    }
    const isCompleted = item.completion?.status === "completed";
    try {
      if (isCompleted) {
        const res = await fetch(
          `/api/planner/completions?block_id=${encodeURIComponent(item.id)}&plan_date=${encodeURIComponent(item.occurs_on)}`,
          { method: "DELETE" },
        );
        const json = await parseJsonSafe<{
          success: boolean;
          error?: string;
        }>(res);
        if (!json.success) {
          toast.error(json.error || "Failed to update");
          return;
        }
        toast.success("Reopened");
      } else {
        const res = await fetch("/api/planner/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block_id: item.id,
            plan_date: item.occurs_on,
            status: "completed",
          }),
        });
        const json = await parseJsonSafe<{
          success: boolean;
          error?: string;
        }>(res);
        if (!json.success) {
          toast.error(json.error || "Failed to update");
          return;
        }
        toast.success(`"${item.title}" — done!`);
      }
      fetchWeek();
    } catch (err) {
      console.error("toggleCompletion", err);
      toast.error("Failed to update");
    }
  };

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => setWeekStart((d) => addDays(d, 7));
  const goThisWeek = () => setWeekStart(startOfWeek(new Date()));

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Weekly Planner
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                Block out your week. Pick a day and a time, decide what
                you&apos;ll do — then show up and tick it off. Discipline is
                built one block at a time.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <StatPill
              icon={Target}
              label="Blocks"
              value={stats.total}
              tone="sky"
            />
            <StatPill
              icon={CheckCircle2}
              label="Done"
              value={stats.completed}
              tone="emerald"
            />
            <StatPill
              icon={TrendingUp}
              label="Rate"
              value={`${completionRate}%`}
              tone="violet"
            />
            <StatPill
              icon={Flame}
              label="Streak"
              value={`${stats.current_streak}d`}
              tone="amber"
            />
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {formatWeekRange(weekStart)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Sunday → Saturday
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goThisWeek}>
            This week
          </Button>
          <div className="inline-flex items-center gap-1 rounded-xl border border-border px-1">
            <button
              type="button"
              onClick={goPrev}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => openCreate(1)}>
              <Plus className="h-4 w-4" />
              Add block
            </Button>
          )}
        </div>
      </div>

      {/* Weekly grid */}
      <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/60 backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Mobile: vertical day-stacked list */}
        <div className="block lg:hidden divide-y divide-border">
          {WEEKDAYS.map((wd) => {
            const dayDate = addDays(weekStart, wd.value);
            const dayIso = toIsoDate(dayDate);
            const isToday = dayIso === todayIso;
            const list = itemsByWeekday.get(wd.value) ?? [];
            return (
              <section key={wd.value} className="p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {dayDate.getUTCDate()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {wd.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {list.length} block
                        {list.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  {canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreate(wd.value)}
                      className="text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  )}
                </div>
                {list.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => canCreate && openCreate(wd.value)}
                    className={cn(
                      "w-full rounded-xl border-2 border-dashed border-border bg-muted/30 py-5 text-xs text-muted-foreground",
                      canCreate && "hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    Nothing planned. {canCreate && "Tap to add a block."}
                  </button>
                ) : (
                  <ul className="space-y-2">
                    {list.map((it) => (
                      <BlockCard
                        key={it.id}
                        item={it}
                        canComplete={canComplete}
                        canUpdate={canUpdate}
                        onToggle={() => toggleCompletion(it)}
                        onEdit={() => openEdit(it)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Desktop: 7-column time grid */}
        <div className="hidden lg:grid lg:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          {/* Header row */}
          <div className="border-b border-border bg-muted/40" />
          {WEEKDAYS.map((wd) => {
            const dayDate = addDays(weekStart, wd.value);
            const dayIso = toIsoDate(dayDate);
            const isToday = dayIso === todayIso;
            const list = itemsByWeekday.get(wd.value) ?? [];
            const done = list.filter(
              (i) => i.completion?.status === "completed",
            ).length;
            return (
              <div
                key={wd.value}
                className={cn(
                  "border-b border-l border-border px-3 py-2.5 text-center",
                  isToday && "bg-primary/5",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {wd.short}
                </p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {dayDate.getUTCDate()}
                  </span>
                  {list.length > 0 && (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {done}/{list.length}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Time gutter + day columns */}
          <div
            className="relative border-r border-border"
            style={{ height: RENDER_MIN_RANGE * 1.2 }}
          >
            {HOUR_LABELS.map((h) => (
              <div
                key={h.min}
                className="absolute left-0 right-0 -translate-y-1/2 pr-1 text-right text-[10px] font-medium text-muted-foreground"
                style={{
                  top: `${((h.min - RENDER_START_MIN) / RENDER_MIN_RANGE) * 100}%`,
                }}
              >
                {h.label}
              </div>
            ))}
          </div>

          {WEEKDAYS.map((wd) => {
            const dayDate = addDays(weekStart, wd.value);
            const dayIso = toIsoDate(dayDate);
            const isToday = dayIso === todayIso;
            const list = itemsByWeekday.get(wd.value) ?? [];
            return (
              <DayColumn
                key={wd.value}
                items={list}
                isToday={isToday}
                canCreate={canCreate}
                canComplete={canComplete}
                canUpdate={canUpdate}
                onAdd={(time) => openCreate(wd.value, time)}
                onEdit={(b) => openEdit(b)}
                onToggle={(b) => toggleCompletion(b)}
              />
            );
          })}
        </div>

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="border-t border-border px-6 py-10 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary/60" />
            <h3 className="mt-3 text-base font-semibold text-foreground">
              Your week is a blank canvas
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              Pick a weekday and add your first time-block. Small, repeated
              commitments compound into real discipline.
            </p>
            {canCreate && (
              <Button className="mt-4" onClick={() => openCreate(1)}>
                <Plus className="h-4 w-4" />
                Plan your first block
              </Button>
            )}
          </div>
        )}
      </div>

      <PlannerBlockModal
        open={modalOpen}
        block={editing}
        defaultWeekday={seedWeekday}
        defaultStartTime={seedStart}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onClose={() => setModalOpen(false)}
        onSaved={fetchWeek}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: "sky" | "emerald" | "violet" | "amber";
}) {
  const tones: Record<string, string> = {
    sky: "from-sky-500/20 to-sky-500/0 text-sky-700 dark:text-sky-300",
    emerald:
      "from-emerald-500/20 to-emerald-500/0 text-emerald-700 dark:text-emerald-300",
    violet:
      "from-violet-500/20 to-violet-500/0 text-violet-700 dark:text-violet-300",
    amber:
      "from-amber-500/20 to-amber-500/0 text-amber-700 dark:text-amber-300",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-border bg-gradient-to-br px-3 py-2",
        tones[tone],
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          {label}
        </p>
        <p className="text-base font-bold leading-tight tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

function DayColumn({
  items,
  isToday,
  canCreate,
  canComplete,
  canUpdate,
  onAdd,
  onEdit,
  onToggle,
}: {
  items: PlannerWeekBlock[];
  isToday: boolean;
  canCreate: boolean;
  canComplete: boolean;
  canUpdate: boolean;
  onAdd: (time: string) => void;
  onEdit: (block: PlannerBlock) => void;
  onToggle: (block: PlannerWeekBlock) => void;
}) {
  const handleEmptyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canCreate) return;
    const target = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - target.top;
    const ratio = Math.max(0, Math.min(1, y / target.height));
    const totalMin =
      RENDER_START_MIN + ratio * RENDER_MIN_RANGE;
    // Snap to 30-minute slots.
    const snapped = Math.round(totalMin / 30) * 30;
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    const hh = String(Math.max(0, Math.min(23, h))).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    onAdd(`${hh}:${mm}`);
  };

  return (
    <div
      className={cn(
        "relative border-l border-border",
        isToday && "bg-primary/5",
      )}
      style={{ height: RENDER_MIN_RANGE * 1.2 }}
    >
      {/* Hour-line grid */}
      {HOUR_LABELS.map((h) => (
        <div
          key={h.min}
          className="absolute left-0 right-0 border-t border-border/60"
          style={{
            top: `${((h.min - RENDER_START_MIN) / RENDER_MIN_RANGE) * 100}%`,
          }}
        />
      ))}

      {/* Click-to-add background */}
      <div
        className={cn(
          "absolute inset-0",
          canCreate && "cursor-pointer hover:bg-primary/[0.04]",
        )}
        onClick={handleEmptyClick}
        aria-label="Add a block here"
      />

      {/* Blocks */}
      {items.map((it) => {
        const start = Math.max(
          RENDER_START_MIN,
          minutesOf(it.start_time),
        );
        const end = Math.min(RENDER_END_MIN, minutesOf(it.end_time));
        const visibleSpan = Math.max(20, end - start);
        const top =
          ((start - RENDER_START_MIN) / RENDER_MIN_RANGE) * 100;
        const height = (visibleSpan / RENDER_MIN_RANGE) * 100;
        const isCompleted = it.completion?.status === "completed";
        return (
          <button
            key={it.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canUpdate) onEdit(it);
            }}
            className={cn(
              "absolute left-1 right-1 overflow-hidden rounded-xl border border-border bg-card px-2 py-1.5 text-left shadow-sm transition-all ring-1",
              isCompleted
                ? "opacity-70 ring-emerald-300/50"
                : (PRIORITY_RING[it.priority] ?? "ring-border"),
              "hover:shadow-md hover:-translate-y-0.5",
            )}
            style={{
              top: `${top}%`,
              height: `${height}%`,
              borderLeftWidth: 4,
              borderLeftColor: it.color,
            }}
          >
            <div className="flex items-start justify-between gap-1">
              <span
                className={cn(
                  "text-[11px] font-semibold leading-tight text-foreground line-clamp-2",
                  isCompleted && "line-through text-muted-foreground",
                )}
                title={it.title}
              >
                {it.title}
              </span>
              {canComplete && (
                <span
                  role="checkbox"
                  aria-checked={isCompleted}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(it);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggle(it);
                    }
                  }}
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer",
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-border bg-card hover:border-primary",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3 w-3 opacity-0" />
                  )}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatTime12(it.start_time)} – {formatTime12(it.end_time)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function BlockCard({
  item,
  canComplete,
  canUpdate,
  onToggle,
  onEdit,
}: {
  item: PlannerWeekBlock;
  canComplete: boolean;
  canUpdate: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const isCompleted = item.completion?.status === "completed";
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-all",
        isCompleted && "opacity-75",
      )}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: item.color,
      }}
    >
      {canComplete && (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={isCompleted}
          className={cn(
            "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            isCompleted
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border bg-card hover:border-primary",
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4 opacity-0" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={() => canUpdate && onEdit()}
        className="flex-1 text-left"
      >
        <p
          className={cn(
            "text-sm font-semibold text-foreground",
            isCompleted && "line-through text-muted-foreground",
          )}
        >
          {item.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime12(item.start_time)} – {formatTime12(item.end_time)}
        </p>
        {item.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}
      </button>
    </li>
  );
}
