"use client";

/**
 * Task Calendar — month grid showing every active task per day.
 *
 * Reads from /api/task-instances/calendar (server-side schedule expansion).
 * Click a date to open a side panel with the full task list for that day.
 * Daily / weekly tasks render on every valid date according to the rule.
 */

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  XCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { toIsoDate } from "@/lib/task-schedule";
import type {
  CalendarBucket,
  TaskPriority,
  TaskScheduleType,
} from "@/types/task";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-emerald-500",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

const SCHEDULE_LABEL: Record<TaskScheduleType, string> = {
  date_specific: "One-off",
  daily: "Daily",
  weekly: "Weekly",
  date_range: "Date range",
};

interface MonthCell {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
}

function buildMonthGrid(year: number, month: number): MonthCell[] {
  const todayIso = toIsoDate(new Date());
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const cells: MonthCell[] = [];

  // Pad with the trailing days of the previous month.
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month, -i));
    const iso = toIsoDate(d);
    cells.push({ date: d, iso, inMonth: false, isToday: iso === todayIso });
  }

  // Days of the current month.
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month, d));
    const iso = toIsoDate(date);
    cells.push({ date, iso, inMonth: true, isToday: iso === todayIso });
  }

  // Pad to a multiple of 7 with the leading days of the next month.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last.getTime() + 86_400_000);
    const iso = toIsoDate(next);
    cells.push({
      date: next,
      iso,
      inMonth: false,
      isToday: iso === todayIso,
    });
  }

  return cells;
}

export default function TaskCalendarPage() {
  const today = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(today.getUTCFullYear());
  const [month, setMonth] = React.useState(today.getUTCMonth()); // 0-indexed
  const [buckets, setBuckets] = React.useState<CalendarBucket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);

  const cells = React.useMemo(() => buildMonthGrid(year, month), [year, month]);

  const yearOptions = React.useMemo(() => {
    const current = today.getUTCFullYear();
    const start = Math.min(current, year) - 10;
    const end = Math.max(current, year) + 10;
    const out: number[] = [];
    for (let y = start; y <= end; y++) out.push(y);
    return out;
  }, [today, year]);

  const fetchBuckets = React.useCallback(async () => {
    setLoading(true);
    try {
      const from = toIsoDate(cells[0].date);
      const to = toIsoDate(cells[cells.length - 1].date);
      const res = await fetch(
        `/api/task-instances/calendar?from=${from}&to=${to}`,
      );
      const data = await parseJsonSafe<{
        success: boolean;
        data: CalendarBucket[];
        error?: string;
      }>(res);
      if (data.success) {
        setBuckets(data.data ?? []);
      } else {
        toast.error(data.error || "Failed to load calendar");
        setBuckets([]);
      }
    } catch (err) {
      console.error("fetchBuckets", err);
      toast.error("Failed to load calendar");
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [cells]);

  React.useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const bucketByDate = React.useMemo(() => {
    const m = new Map<string, CalendarBucket>();
    for (const b of buckets) m.set(b.date, b);
    return m;
  }, [buckets]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    setMonth(today.getUTCMonth());
    setYear(today.getUTCFullYear());
  };

  const selectedBucket = selectedDate
    ? bucketByDate.get(selectedDate)
    : undefined;

  return (
    <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Task Calendar
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every active task laid out by date — click a day to see its tasks.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            className="h-9"
          >
            Today
          </Button>
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-1">
            <button
              type="button"
              onClick={goPrev}
              className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-primary"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger
                aria-label="Month"
                className="h-8 w-[120px] border-0 bg-transparent px-2 text-sm font-semibold shadow-none focus:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger
                aria-label="Year"
                className="h-8 w-[88px] border-0 bg-transparent px-2 text-sm font-semibold tabular-nums shadow-none focus:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={goNext}
              className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-primary"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Calendar grid */}
        <div className="relative">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAY_HEADERS.map((wd) => (
              <div
                key={wd}
                className="px-1 py-2 sm:px-3 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center"
              >
                <span className="sm:hidden">{wd[0]}</span>
                <span className="hidden sm:inline">{wd}</span>
              </div>
            ))}
          </div>

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          )}

          <div className="grid grid-cols-7 auto-rows-fr">
            {cells.map((cell) => {
              const bucket = bucketByDate.get(cell.iso);
              const tasks = bucket?.tasks ?? [];
              const dayNum = cell.date.getUTCDate();
              const isSelected = selectedDate === cell.iso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso)}
                  className={cn(
                    "min-h-[60px] sm:min-h-[96px] border-b border-r border-border p-1 sm:p-2 text-left transition-colors flex flex-col gap-0.5 sm:gap-1",
                    !cell.inMonth && "bg-muted/20 text-muted-foreground",
                    cell.inMonth && "hover:bg-primary/5",
                    isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/40",
                  )}
                  aria-label={`${cell.iso}, ${tasks.length} tasks`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        cell.isToday
                          ? "bg-primary text-primary-foreground"
                          : cell.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {dayNum}
                    </span>
                    {tasks.length > 0 && (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {tasks.length}
                      </span>
                    )}
                  </div>
                  <ul className="hidden sm:flex flex-col flex-1 space-y-0.5 overflow-hidden">
                    {tasks.slice(0, 3).map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-1.5 truncate"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            PRIORITY_DOT[t.priority],
                          )}
                          aria-hidden
                        />
                        <span className="text-[11px] text-foreground/80 truncate">
                          {t.title}
                        </span>
                      </li>
                    ))}
                    {tasks.length > 3 && (
                      <li className="text-[10px] text-muted-foreground">
                        +{tasks.length - 3} more
                      </li>
                    )}
                  </ul>
                  {tasks.length > 0 && (
                    <div className="sm:hidden flex flex-wrap gap-0.5 mt-auto">
                      {tasks.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            PRIORITY_DOT[t.priority],
                          )}
                          aria-hidden
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <aside className="border-t lg:border-t-0 lg:border-l border-border bg-card">
          <DayPanel
            iso={selectedDate}
            bucket={selectedBucket}
            onClose={() => setSelectedDate(null)}
          />
        </aside>
      </div>
    </div>
  );
}

function DayPanel({
  iso,
  bucket,
  onClose,
}: {
  iso: string | null;
  bucket: CalendarBucket | undefined;
  onClose: () => void;
}) {
  if (!iso) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 py-10 text-center">
        <Circle className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium text-foreground">
          Select a date
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
          Click any day in the calendar to see the tasks scheduled for it.
        </p>
      </div>
    );
  }

  const date = new Date(iso);
  const formatted = date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const tasks = bucket?.tasks ?? [];

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Selected day
          </p>
          <p className="text-base font-semibold text-foreground truncate">
            {formatted}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[600px]">
        {tasks.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            No tasks scheduled for this day.
          </div>
        ) : (
          tasks.map((t) => {
            const completed = t.status === "completed";
            const missed = !completed && iso < toIsoDate(new Date());
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  completed &&
                    "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10",
                  missed &&
                    "border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10",
                  !completed && !missed && "border-border bg-muted/30",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      PRIORITY_DOT[t.priority],
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {SCHEDULE_LABEL[t.schedule_type]}
                    </p>
                  </div>
                  <StatusBadge completed={completed} missed={missed} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  completed,
  missed,
}: {
  completed: boolean;
  missed: boolean;
}) {
  if (completed) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
        title="Completed"
      >
        <CheckCircle2 className="h-3 w-3" />
        Done
      </span>
    );
  }
  if (missed) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300"
        title="Not completed"
      >
        <XCircle className="h-3 w-3" />
        Missed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      title="Scheduled"
    >
      <Circle className="h-3 w-3" />
      Scheduled
    </span>
  );
}
