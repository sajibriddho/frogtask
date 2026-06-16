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
  Pencil,
  RotateCcw,
  Tag as TagIcon,
  AlertTriangle,
  CalendarClock,
  Loader2,
  Infinity as InfinityIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { formatScheduleSummary, formatTaskDate } from "@/lib/task-schedule";
import type {
  Task,
  TaskPriority,
  TaskScheduleType,
  TodayTask,
} from "@/types/task";
import type { TaskTag } from "@/types/task-tag";

import { TaskFormModal } from "@/app/tasks/_components/TaskFormModal";
import { ManageTagsModal } from "@/app/tasks/_components/ManageTagsModal";
import { CompletionBurst } from "@/components/common/CompletionBurst";
import { CompletionToggle } from "@/components/common/CompletionToggle";
import {
  CompletionLoading,
  withMinDuration,
} from "@/components/common/CompletionLoading";

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
  date_range: "Date range",
  anytime: "Anytime",
};

type FilterChip = "all" | "pending" | "completed" | "unfinished" | "anytime";

const UNTAGGED_KEY = "__untagged__";
const UNTAGGED_LABEL = "Untagged";

// ─── Page ──────────────────────────────────────────────────────────────

export default function TodayTasksPage() {
  const { has } = usePermissions();
  const canComplete = has("today.complete");
  const canUpdate = has("tasks.all.update");

  const [items, setItems] = React.useState<TodayTask[]>([]);
  const [tags, setTags] = React.useState<TaskTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [filter, setFilter] = React.useState<FilterChip>("all");

  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [manageTagsOpen, setManageTagsOpen] = React.useState(false);
  // One celebration overlay at a time. Keyed by task id so rapid clicks
  // restart the animation instead of stacking overlays.
  const [celebrating, setCelebrating] =
    React.useState<{
      id: number;
      title: string;
      origin?: { x: number; y: number };
    } | null>(null);
  const celebrationSeq = React.useRef(0);
  const [completingTitle, setCompletingTitle] = React.useState<string | null>(
    null,
  );

  const fetchToday = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
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
      if (!options?.silent) setLoading(false);
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

  // Split the response into three buckets: today's scheduled instances,
  // carried-over unfinished instances, and no-deadline "anytime" tasks.
  // Each of those three has its own filter chip — they are NOT counted in
  // All/Pending/Completed so today's view stays focused on today.
  const { todayItems, overdueItems, anytimeItems } = React.useMemo(() => {
    const todayItems: TodayTask[] = [];
    const overdueItems: TodayTask[] = [];
    const anytimeItems: TodayTask[] = [];
    for (const it of items) {
      if (it.is_anytime) anytimeItems.push(it);
      else if (it.is_overdue) overdueItems.push(it);
      else todayItems.push(it);
    }
    return { todayItems, overdueItems, anytimeItems };
  }, [items]);

  const counts = React.useMemo(() => {
    let pending = 0;
    let completed = 0;
    for (const it of todayItems) {
      if (it.instance?.status === "completed") completed++;
      else pending++;
    }
    return {
      all: todayItems.length,
      pending,
      completed,
      unfinished: overdueItems.length,
      anytime: anytimeItems.length,
    };
  }, [todayItems, overdueItems, anytimeItems]);

  const filtered = React.useMemo(() => {
    if (filter === "unfinished") return overdueItems;
    if (filter === "anytime") return anytimeItems;
    if (filter === "all") return todayItems;
    if (filter === "completed")
      return todayItems.filter((t) => t.instance?.status === "completed");
    return todayItems.filter((t) => t.instance?.status !== "completed");
  }, [todayItems, overdueItems, anytimeItems, filter]);

  // Group by tag, ordered A→Z by tag name (untagged last).
  const tagGroups = React.useMemo(() => {
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

  // Group the Unfinished tab by the original task_date — oldest at the top so
  // the staleness is obvious. Within a date, items keep their API order.
  const dateGroups = React.useMemo(() => {
    if (filter !== "unfinished") return [];
    const map = new Map<string, TodayTask[]>();
    for (const it of overdueItems) {
      const key = it.overdue_date ?? "";
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return Array.from(map.entries())
      .map(([date, list]) => ({ date, items: list }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [filter, overdueItems]);

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

  const markPending = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleReopen = async (item: TodayTask) => {
    if (!item.instance) return;
    const instanceId = item.instance.id;
    if (pendingIds.has(instanceId)) return;
    markPending(instanceId, true);
    try {
      const ok = await updateInstance(instanceId, { status: "pending" });
      if (ok) {
        toast.success("Task reopened");
        await fetchToday({ silent: true });
      }
    } finally {
      markPending(instanceId, false);
    }
  };

  const handleComplete = async (
    item: TodayTask,
    origin?: { x: number; y: number },
  ) => {
    if (!item.instance) return;
    const instanceId = item.instance.id;
    if (pendingIds.has(instanceId)) return;
    markPending(instanceId, true);
    setCompletingTitle(item.title);
    try {
      const ok = await withMinDuration(
        updateInstance(instanceId, { status: "completed" }),
        700,
      );
      if (ok) {
        // Joyful celebration — the toast is the silent fallback, the
        // burst is the moment. Re-key on every fire so rapid clicks
        // restart the animation instead of stacking overlays.
        celebrationSeq.current += 1;
        setCelebrating({
          id: celebrationSeq.current,
          title: item.title,
          origin,
        });
        toast.success(`"${item.title}" completed`, { icon: "🐸" });
        await fetchToday({ silent: true });
      }
    } finally {
      markPending(instanceId, false);
      setCompletingTitle(null);
    }
  };

  const handleEdit = async (item: TodayTask) => {
    try {
      const res = await fetch(`/api/tasks/${item.id}`);
      const data = await parseJsonSafe<{
        success: boolean;
        data: Task;
        error?: string;
      }>(res);
      if (!data.success) {
        toast.error(data.error || "Failed to load task");
        return;
      }
      setEditingTask({ ...(data.data as Task), id: item.id });
      setEditModalOpen(true);
    } catch (err) {
      console.error("openEdit (today)", err);
      toast.error("Failed to load task");
    }
  };

  const onTagsChanged = React.useCallback(() => {
    fetchTags();
    fetchToday();
  }, [fetchTags, fetchToday]);

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
            { id: "all", label: "All", count: counts.all, tone: "default" },
            { id: "pending", label: "Pending", count: counts.pending, tone: "default" },
            { id: "completed", label: "Completed", count: counts.completed, tone: "default" },
            { id: "unfinished", label: "Unfinished", count: counts.unfinished, tone: "rose" },
            { id: "anytime", label: "Anytime", count: counts.anytime, tone: "yellow" },
          ] as const
        ).map((chip) => {
          const active = filter === chip.id;
          const isRose = chip.tone === "rose";
          const isYellow = chip.tone === "yellow";
          const Icon = isRose ? AlertTriangle : isYellow ? InfinityIcon : null;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                active
                  ? isRose
                    ? "bg-rose-600 text-white shadow-sm"
                    : isYellow
                      ? "bg-yellow-500 text-white shadow-sm"
                      : "bg-primary text-primary-foreground shadow-sm"
                  : isRose && chip.count > 0
                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300"
                    : isYellow && chip.count > 0
                      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              <span>{chip.label}</span>
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                  active
                    ? "bg-white/20 text-inherit"
                    : isRose && chip.count > 0
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200"
                      : isYellow && chip.count > 0
                        ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-500/25 dark:text-yellow-200"
                        : "bg-card text-muted-foreground",
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List — grouped by tag (today views) or by date (Unfinished, oldest first) */}
      <div className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyToday filter={filter} totalToday={counts.all} />
        ) : filter === "unfinished" ? (
          dateGroups.map(({ date, items: groupItems }) => (
            <section key={date} className="space-y-2">
              <DateGroupHeader date={date} count={groupItems.length} />
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <TaskRow
                    key={item.instance?.id ?? item.id}
                    item={item}
                    canComplete={canComplete}
                    canEdit={canUpdate}
                    pending={
                      item.instance ? pendingIds.has(item.instance.id) : false
                    }
                    onCheck={(origin) => handleComplete(item, origin)}
                    onReopen={() => handleReopen(item)}
                    onEdit={() => handleEdit(item)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : filter === "anytime" ? (
          <section className="space-y-2">
            <AnytimeGroupHeader count={anytimeItems.length} />
            <div className="space-y-2">
              {tagGroups.flatMap(({ items: groupItems }) =>
                groupItems.map((item) => (
                  <TaskRow
                    key={item.instance?.id ?? item.id}
                    item={item}
                    canComplete={canComplete}
                    canEdit={canUpdate}
                    pending={
                      item.instance ? pendingIds.has(item.instance.id) : false
                    }
                    onCheck={(origin) => handleComplete(item, origin)}
                    onReopen={() => handleReopen(item)}
                    onEdit={() => handleEdit(item)}
                  />
                )),
              )}
            </div>
          </section>
        ) : (
          tagGroups.map(({ key, tag, items: groupItems }) => (
            <section key={key} className="space-y-2">
              <TagGroupHeader tag={tag} count={groupItems.length} />
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <TaskRow
                    key={item.instance?.id ?? item.id}
                    item={item}
                    canComplete={canComplete}
                    canEdit={false}
                    pending={
                      item.instance ? pendingIds.has(item.instance.id) : false
                    }
                    onCheck={(origin) => handleComplete(item, origin)}
                    onReopen={() => handleReopen(item)}
                    onEdit={() => handleEdit(item)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <TaskFormModal
        open={editModalOpen}
        onOpenChange={(o) => {
          setEditModalOpen(o);
          if (!o) setEditingTask(null);
        }}
        task={editingTask}
        tags={tags}
        onManageTags={() => setManageTagsOpen(true)}
        onSaved={fetchToday}
      />

      <ManageTagsModal
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        onChanged={onTagsChanged}
      />

      <CompletionLoading open={!!completingTitle} title={completingTitle} />

      {celebrating && (
        <CompletionBurst
          key={celebrating.id}
          title={celebrating.title}
          origin={celebrating.origin}
          onDone={() => setCelebrating(null)}
        />
      )}
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

function AnytimeGroupHeader({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <InfinityIcon className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
        Anytime — no deadline
      </h3>
      <span className="text-[11px] text-muted-foreground">({count})</span>
    </div>
  );
}

function DateGroupHeader({ date, count }: { date: string; count: number }) {
  const daysOld = React.useMemo(() => {
    if (!date) return 0;
    const due = new Date(date);
    if (Number.isNaN(due.getTime())) return 0;
    const now = new Date();
    const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.max(0, Math.round((todayUtc - dueUtc) / 86400000));
  }, [date]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <CalendarClock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
        {formatTaskDate(date)}
      </h3>
      <span className="text-[11px] text-muted-foreground">({count})</span>
      {daysOld > 0 && (
        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
          · {daysOld} day{daysOld === 1 ? "" : "s"} overdue
        </span>
      )}
    </div>
  );
}

function TaskRow({
  item,
  canComplete,
  canEdit,
  pending,
  onCheck,
  onReopen,
  onEdit,
}: {
  item: TodayTask;
  canComplete: boolean;
  canEdit: boolean;
  pending: boolean;
  onCheck: (origin?: { x: number; y: number }) => void;
  onReopen: () => void;
  onEdit: () => void;
}) {
  const completed = item.instance?.status === "completed";
  const isRange = item.schedule_type === "date_range";
  const isAnytime = item.is_anytime || item.schedule_type === "anytime";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-2xl border bg-card px-4 py-3 sm:px-5 sm:py-4 transition-colors",
        isAnytime
          ? "border-l-4 border-l-yellow-500 border-y-border border-r-border bg-yellow-50/40 dark:bg-yellow-500/5"
          : isRange
            ? "border-l-4 border-l-violet-500 border-y-border border-r-border bg-violet-50/40 dark:bg-violet-500/5"
            : "border-border",
        completed && "bg-muted/30 border-dashed",
        pending && "opacity-75",
      )}
    >
      <div className="flex h-5 items-center">
        <CompletionToggle
          checked={completed}
          pending={pending}
          disabled={!canComplete}
          size="md"
          onChange={(next, origin) => {
            if (next) onCheck(origin);
            else onReopen();
          }}
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
          {isRange && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              title="Date-range task — appears every day in the window until you check it off"
            >
              <CalendarRange className="h-3 w-3" />
              Range
            </span>
          )}
          {isAnytime && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
              title="Anytime task — no deadline; sits here until you check it off"
            >
              <InfinityIcon className="h-3 w-3" />
              Anytime
            </span>
          )}
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

      <div className="flex flex-col items-end gap-1">
        {completed && canComplete && (
          <button
            type="button"
            onClick={onReopen}
            disabled={pending}
            className="self-start text-[11px] font-medium text-muted-foreground hover:text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reopen task"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Reopen
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="self-start text-[11px] font-medium text-muted-foreground hover:text-primary inline-flex items-center gap-1 px-2 py-1 rounded-md"
            title="Edit task"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
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

  if (filter === "unfinished") {
    title = "No unfinished tasks";
    description = "Nothing has been left behind from earlier days — nice work.";
  } else if (filter === "anytime") {
    title = "No anytime tasks";
    description =
      "Anytime tasks have no deadline — create one to keep a backlog you can chip away at whenever.";
  } else if (totalToday > 0) {
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

