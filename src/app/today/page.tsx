"use client";

/**
 * Today's Tasks — the daily working screen.
 *
 * Reads /api/task-instances/today which (a) matches every active rule
 * assigned to the caller against today's date and (b) lazily creates a
 * TaskInstance for each match. Marking a task complete only writes to
 * task_instances — daily / weekly schedules keep running.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  Sun,
  CalendarRange,
  CheckCircle2,
  Circle,
  ListChecks,
  RotateCcw,
  Tag as TagIcon,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { formatScheduleSummary } from "@/lib/task-schedule";
import type {
  TaskPriority,
  TaskScheduleType,
  TodayTask,
} from "@/types/task";
import type { TaskTag } from "@/types/task-tag";

// ─── Constants ─────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  medium: {
    label: "Medium",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  high: {
    label: "High",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  urgent: {
    label: "Urgent",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

const SCHEDULE_LABEL: Record<TaskScheduleType, string> = {
  date_specific: "One-off",
  daily: "Daily",
  weekly: "Weekly",
};

type FilterChip = "all" | "pending" | "completed";

const UNTAGGED_KEY = "__untagged__";
const UNTAGGED_LABEL = "Untagged";

// ─── Page ──────────────────────────────────────────────────────────────

export default function TodayTasksPage() {
  const { has } = usePermissions();
  const canComplete = has("today.complete");

  const [items, setItems] = React.useState<TodayTask[]>([]);
  const [tags, setTags] = React.useState<TaskTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<FilterChip>("all");

  const fetchToday = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/task-instances/today");
      const data = await parseJsonSafe<{
        success: boolean;
        data: TodayTask[];
        error?: string;
      }>(res);
      if (data.success) {
        setItems(data.data ?? []);
      } else {
        toast.error(data.error || "Failed to load today's tasks");
      }
    } catch (err) {
      console.error("fetchToday", err);
      toast.error("Failed to load today's tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = React.useCallback(async () => {
    try {
      const res = await fetch("/api/task-tags", { cache: "no-store" });
      const data = await parseJsonSafe<{
        success: boolean;
        data?: TaskTag[];
        error?: string;
      }>(res);
      if (data.success) {
        setTags(data.data ?? []);
      }
    } catch (err) {
      console.error("fetchTags (today)", err);
    }
  }, []);

  React.useEffect(() => {
    fetchToday();
    fetchTags();
  }, [fetchToday, fetchTags]);

  const tagsById = React.useMemo(() => {
    const m = new Map<string, TaskTag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const counts = React.useMemo(() => {
    let pending = 0;
    let completed = 0;
    for (const it of items) {
      if (it.instance?.status === "completed") completed++;
      else pending++;
    }
    return { all: items.length, pending, completed };
  }, [items]);

  const filtered = React.useMemo(() => {
    if (filter === "all") return items;
    if (filter === "completed")
      return items.filter((t) => t.instance?.status === "completed");
    return items.filter((t) => t.instance?.status !== "completed");
  }, [items, filter]);

  // Group by tag, ordered A→Z by tag name (untagged last).
  const groups = React.useMemo(() => {
    const map = new Map<string, TodayTask[]>();
    for (const it of filtered) {
      const key = it.tag_id || UNTAGGED_KEY;
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    const entries: Array<{ key: string; tag: TaskTag | null; items: TodayTask[] }> = [];
    for (const [key, list] of map.entries()) {
      entries.push({
        key,
        tag: key === UNTAGGED_KEY ? null : tagsById.get(key) ?? null,
        items: list,
      });
    }
    entries.sort((a, b) => {
      const aName = a.key === UNTAGGED_KEY ? "￿" : (a.tag?.name ?? "￿").toLowerCase();
      const bName = b.key === UNTAGGED_KEY ? "￿" : (b.tag?.name ?? "￿").toLowerCase();
      if (aName === bName) return 0;
      return aName < bName ? -1 : 1;
    });
    return entries;
  }, [filtered, tagsById]);

  const today = React.useMemo(() => new Date(), []);
  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const updateInstance = async (
    instanceId: string,
    update: { status?: string },
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/task-instances/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!data.success) {
        toast.error(data.error || "Failed to update task");
        return false;
      }
      return true;
    } catch (err) {
      console.error("updateInstance", err);
      toast.error("Failed to update task");
      return false;
    }
  };

  const handleReopen = async (item: TodayTask) => {
    if (!item.instance) return;
    const ok = await updateInstance(item.instance.id, { status: "pending" });
    if (ok) {
      toast.success("Task reopened");
      fetchToday();
    }
  };

  const handleComplete = async (item: TodayTask) => {
    if (!item.instance) return;
    const ok = await updateInstance(item.instance.id, { status: "completed" });
    if (ok) {
      toast.success(`"${item.title}" completed`);
      fetchToday();
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero / summary */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Sun className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Today&apos;s Tasks
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayLabel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:flex">
            <SummaryStat
              icon={ListChecks}
              label="Total"
              value={counts.all}
              tone="default"
            />
            <SummaryStat
              icon={Circle}
              label="Pending"
              value={counts.pending}
              tone="amber"
            />
            <SummaryStat
              icon={CheckCircle2}
              label="Completed"
              value={counts.completed}
              tone="emerald"
            />
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "all", label: "All", count: counts.all },
            { id: "pending", label: "Pending", count: counts.pending },
            { id: "completed", label: "Completed", count: counts.completed },
          ] as const
        ).map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <span>{chip.label}</span>
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                  active
                    ? "bg-white/20 text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List — grouped by tag, A → Z */}
      <div className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyToday filter={filter} totalToday={counts.all} />
        ) : (
          groups.map(({ key, tag, items: groupItems }) => (
            <section key={key} className="space-y-2">
              <TagGroupHeader tag={tag} count={groupItems.length} />
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <TaskRow
                    key={item.id}
                    item={item}
                    canComplete={canComplete}
                    onCheck={() => handleComplete(item)}
                    onReopen={() => handleReopen(item)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "default" | "amber" | "emerald";
}) {
  const tones: Record<typeof tone, string> = {
    default: "bg-card text-foreground",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border px-3 py-2 sm:px-4",
        tones[tone],
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide opacity-80 leading-none">
          {label}
        </p>
        <p className="text-lg font-semibold tabular-nums leading-none mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}

function TagGroupHeader({
  tag,
  count,
}: {
  tag: TaskTag | null;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: tag?.color ?? "#9ca3af" }}
      />
      <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        {tag?.name ?? UNTAGGED_LABEL}
      </h3>
      <span className="text-[11px] text-muted-foreground">({count})</span>
    </div>
  );
}

function TaskRow({
  item,
  canComplete,
  onCheck,
  onReopen,
}: {
  item: TodayTask;
  canComplete: boolean;
  onCheck: () => void;
  onReopen: () => void;
}) {
  const completed = item.instance?.status === "completed";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:px-5 sm:py-4 transition-colors",
        completed && "bg-muted/30 border-dashed",
      )}
    >
      <div className="pt-0.5">
        <Checkbox
          checked={completed}
          disabled={!canComplete}
          onCheckedChange={(next) => {
            if (!canComplete) return;
            if (next) onCheck();
            else onReopen();
          }}
          aria-label={completed ? "Reopen task" : "Mark task complete"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <h3
            className={cn(
              "min-w-0 text-sm font-semibold text-foreground break-words",
              completed && "line-through text-muted-foreground",
            )}
          >
            {item.title}
          </h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              PRIORITY_BADGE[item.priority].className,
            )}
          >
            {PRIORITY_BADGE[item.priority].label}
          </span>
        </div>

        {item.description && !completed && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">
            {item.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="h-3 w-3" />
            {SCHEDULE_LABEL[item.schedule_type]}
          </span>
          <span className="inline-flex items-center gap-1">
            · {formatScheduleSummary(item)}
          </span>
          {item.reminder_time && (
            <span className="inline-flex items-center gap-1">
              · ⏰ {item.reminder_time}
            </span>
          )}
        </div>

        {completed && item.instance?.remarks && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            “{item.instance.remarks}”
          </p>
        )}
      </div>

      {completed && canComplete && (
        <button
          type="button"
          onClick={onReopen}
          className="self-start text-[11px] font-medium text-muted-foreground hover:text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md"
          title="Reopen task"
        >
          <RotateCcw className="h-3 w-3" />
          Reopen
        </button>
      )}
    </div>
  );
}

function EmptyToday({
  filter,
  totalToday,
}: {
  filter: FilterChip;
  totalToday: number;
}) {
  let title = "Nothing scheduled today";
  let description =
    "Create a task on the All Tasks page or wait for a daily / weekly task to come around.";

  if (totalToday > 0) {
    if (filter === "completed") {
      title = "No completed tasks yet";
      description = "Tick a task off to see it here.";
    } else if (filter === "pending") {
      title = "All caught up!";
      description = "Every task for today is checked off. Great work.";
    }
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
        <CheckCircle2 className="h-6 w-6" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        {description}
      </p>
    </div>
  );
}

