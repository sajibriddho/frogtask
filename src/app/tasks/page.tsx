"use client";

/**
 * All Tasks — central page for managing the caller's task RULES.
 *
 * Lists every task the user owns. "Create task" opens TaskFormModal in
 * create mode (defaults to "Today" — one click); the row pencil opens
 * it in edit mode. Daily/weekly completion still happens on the Today
 * screen — but date-specific rules can be ticked off in-place here,
 * since they only ever fire on a single calendar day.
 *
 * Tasks are grouped by tag (A–Z, untagged last) so the table reads as
 * tag sections. The "Manage tags" button opens a modal for CRUD on the
 * caller's tags.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  ListChecks,
  Pencil,
  Trash2,
  Eye,
  Power,
  PowerOff,
  Calendar,
  Repeat,
  CalendarDays,
  CheckCircle2,
  Circle,
  RotateCcw,
  Tag as TagIcon,
  MoreHorizontal,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MasterTableHeader } from "@/components/master/MasterTableHeader";
import { MasterTableEmpty } from "@/components/master/MasterTableEmpty";
import { MasterPagination } from "@/components/master/MasterPagination";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions } from "@/hooks/usePermissions";
import { useSort } from "@/hooks/useSort";
import { formatScheduleSummary } from "@/lib/task-schedule";
import type {
  Task,
  TaskPriority,
  TaskScheduleType,
  TaskStatus,
  TaskWithInstance,
} from "@/types/task";
import type { TaskTag } from "@/types/task-tag";

import { TaskFormModal } from "./_components/TaskFormModal";
import { ManageTagsModal } from "./_components/ManageTagsModal";

// ─── Constants ─────────────────────────────────────────────────────────

const SCHEDULE_TYPE_LABEL: Record<TaskScheduleType, string> = {
  date_specific: "Date specific",
  daily: "Daily",
  weekly: "Weekly",
};

const SCHEDULE_TYPE_ICON: Record<TaskScheduleType, React.ElementType> = {
  date_specific: Calendar,
  daily: Repeat,
  weekly: CalendarDays,
};

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
    className:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
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

const UNTAGGED_KEY = "__untagged__";
const UNTAGGED_LABEL = "Untagged";
const NUM_COLUMNS = 5;

// ─── Page ──────────────────────────────────────────────────────────────

export default function AllTasksPage() {
  const { has } = usePermissions();
  const canCreate = has("tasks.all.create");
  const canUpdate = has("tasks.all.update");
  const canDelete = has("tasks.all.delete");
  const canToggle = has("tasks.all.toggle");
  const canComplete = has("today.complete");

  const [list, setList] = React.useState<TaskWithInstance[]>([]);
  const [tags, setTags] = React.useState<TaskTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterSchedule, setFilterSchedule] = React.useState<string>("");
  const [filterPriority, setFilterPriority] = React.useState<string>("");
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [filterTag, setFilterTag] = React.useState<string>("");

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [viewingTask, setViewingTask] = React.useState<Task | null>(null);
  const [manageTagsOpen, setManageTagsOpen] = React.useState(false);

  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [completingId, setCompletingId] = React.useState<string | null>(null);
  const [deactivateTask, setDeactivateTask] = React.useState<Task | null>(null);

  // ─── Data fetch ─────────────────────────────────────────────────────
  const fetchTasks = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await parseJsonSafe<{
        success: boolean;
        data: Array<TaskWithInstance & { _id?: string }>;
        error?: string;
      }>(res);
      if (data.success) {
        const normalised: TaskWithInstance[] = (data.data ?? []).map((d) => ({
          ...d,
          id: d.id ?? d._id ?? "",
          instance: d.instance ?? null,
        }));
        setList(normalised);
      } else {
        toast.error(data.error || "Failed to load tasks");
      }
    } catch (err) {
      console.error("fetchTasks", err);
      toast.error("Failed to load tasks");
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
      console.error("fetchTags", err);
    }
  }, []);

  React.useEffect(() => {
    fetchTasks();
    fetchTags();
  }, [fetchTasks, fetchTags]);

  // Lookups for tag id → meta.
  const tagsById = React.useMemo(() => {
    const m = new Map<string, TaskTag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  // ─── Derived ────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let out = list;
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      out = out.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        const tag = t.tag_id ? tagsById.get(t.tag_id) : undefined;
        return tag ? tag.name.toLowerCase().includes(q) : false;
      });
    }
    if (filterSchedule)
      out = out.filter((t) => t.schedule_type === filterSchedule);
    if (filterPriority) out = out.filter((t) => t.priority === filterPriority);
    if (filterStatus) out = out.filter((t) => t.status === filterStatus);
    if (filterTag) {
      if (filterTag === UNTAGGED_KEY) {
        out = out.filter((t) => !t.tag_id);
      } else {
        out = out.filter((t) => t.tag_id === filterTag);
      }
    }
    return out;
  }, [
    list,
    searchTerm,
    filterSchedule,
    filterPriority,
    filterStatus,
    filterTag,
    tagsById,
  ]);

  type SortKey = "title" | "schedule_type" | "priority" | "status" | "createdAt";
  const { sorted, sortKey, direction, requestSort } = useSort<
    TaskWithInstance,
    SortKey
  >(filtered, "createdAt", "desc");

  // Layer tag-grouping on top of the column sort: tag-name A→Z, untagged
  // last; within each tag preserve the active sort order.
  const groupedSorted = React.useMemo(() => {
    const tagSortKey = (t: TaskWithInstance): string => {
      if (!t.tag_id) return "￿"; // push untagged to the end
      const meta = tagsById.get(t.tag_id);
      return meta ? meta.name.toLowerCase() : "￿";
    };
    return [...sorted].sort((a, b) => {
      const aKey = tagSortKey(a);
      const bKey = tagSortKey(b);
      if (aKey === bKey) return 0;
      return aKey < bKey ? -1 : 1;
    });
  }, [sorted, tagsById]);

  const {
    pageData,
    start,
    end,
    totalPages,
    currentPage,
    setCurrentPage,
    goPrev,
    goNext,
  } = usePagination({ items: groupedSorted });

  // For each row in the current page, decide whether it starts a new tag group.
  const pageRows = React.useMemo(() => {
    let prevTag: string | null = null;
    // First row of the page should also show a header — derive its starter.
    return pageData.map((task) => {
      const currentTag = task.tag_id || UNTAGGED_KEY;
      const showHeader = currentTag !== prevTag;
      prevTag = currentTag;
      return { task, showHeader, tagKey: currentTag };
    });
  }, [pageData]);

  // Reset to page 1 when filters change.
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filterSchedule,
    filterPriority,
    filterStatus,
    filterTag,
    setCurrentPage,
  ]);

  // ─── Actions ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEdit = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      const data = await parseJsonSafe<{
        success: boolean;
        data: Task;
        error?: string;
      }>(res);
      if (!data.success) {
        toast.error(data.error || "Failed to load task");
        return;
      }
      setEditingTask({ ...(data.data as Task), id: task.id });
      setModalOpen(true);
    } catch (err) {
      console.error("openEdit", err);
      toast.error("Failed to load task");
    }
  };

  const setStatus = async (task: Task, next: TaskStatus) => {
    setTogglingId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success(next === "Active" ? "Task activated" : "Task deactivated");
        fetchTasks();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("toggle status", err);
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const onToggle = (task: Task) => {
    if (task.status === "Active") {
      setDeactivateTask(task);
    } else {
      setStatus(task, "Active");
    }
  };

  const setCompletion = async (task: TaskWithInstance, completed: boolean) => {
    setCompletingId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success(
          completed ? `"${task.title}" completed` : "Task reopened",
        );
        fetchTasks();
      } else {
        toast.error(data.error || "Failed to update completion");
      }
    } catch (err) {
      console.error("toggle completion", err);
      toast.error("Failed to update completion");
    } finally {
      setCompletingId(null);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTask) return;
    const task = deactivateTask;
    setDeactivateTask(null);
    await setStatus(task, "Inactive");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${deleteId}`, { method: "DELETE" });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (data.success) {
        toast.success("Task deleted");
        fetchTasks();
      } else {
        toast.error(data.error || "Failed to delete task");
      }
    } catch (err) {
      console.error("delete", err);
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // Re-fetch tasks after a tag rename/delete so the grouping is correct.
  const onTagsChanged = React.useCallback(() => {
    fetchTags();
    fetchTasks();
  }, [fetchTags, fetchTasks]);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden">
        <MasterTableHeader
          icon={ListChecks}
          title="All Tasks"
          description="Create and manage your task rules. Tasks are grouped by tag, A → Z."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onAddClick={canCreate ? openCreate : undefined}
          addLabel="Create task"
        />

        {/* Filters + Manage tags */}
        <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SearchableSelect
              instanceId="filter-tag"
              options={[
                { value: "", label: "All tags" },
                ...tags.map((t) => ({ value: t.id, label: t.name })),
                { value: UNTAGGED_KEY, label: UNTAGGED_LABEL },
              ]}
              value={filterTag || ""}
              onChange={(v) => setFilterTag(v ?? "")}
              placeholder="All tags"
              isClearable
            />
            <SearchableSelect
              instanceId="filter-schedule"
              options={[
                { value: "", label: "All schedules" },
                { value: "date_specific", label: "Date specific" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
              ]}
              value={filterSchedule || ""}
              onChange={(v) => setFilterSchedule(v ?? "")}
              placeholder="All schedules"
              isClearable
            />
            <SearchableSelect
              instanceId="filter-priority"
              options={[
                { value: "", label: "All priorities" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
              value={filterPriority || ""}
              onChange={(v) => setFilterPriority(v ?? "")}
              placeholder="All priorities"
              isClearable
            />
            <SearchableSelect
              instanceId="filter-status"
              options={[
                { value: "", label: "All statuses" },
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
              value={filterStatus || ""}
              onChange={(v) => setFilterStatus(v ?? "")}
              placeholder="All statuses"
              isClearable
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {tags.length === 0
                ? "No tags yet — create one to start grouping your tasks."
                : `${tags.length} tag${tags.length === 1 ? "" : "s"} available.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManageTagsOpen(true)}
              className="shrink-0"
            >
              <TagIcon className="mr-1.5 h-4 w-4" />
              Manage tags
            </Button>
          </div>
        </div>

        <div className="bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />
            </div>
          ) : (
            <Table className="min-w-0">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="table-header-cell w-12">SL</TableHead>
                  <SortableTableHead
                    sortKey="title"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                    className="w-[70%]"
                  >
                    Task
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="schedule_type"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Schedule
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="priority"
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                  >
                    Priority
                  </SortableTableHead>
                  <TableHead className="py-3.5 px-4 font-medium text-muted-foreground text-sm text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <MasterTableEmpty
                    colSpan={NUM_COLUMNS}
                    hasSearch={
                      !!(
                        searchTerm.trim() ||
                        filterSchedule ||
                        filterPriority ||
                        filterStatus ||
                        filterTag
                      )
                    }
                    messageEmpty="Create your first task"
                  />
                ) : (
                  pageRows.map(({ task, showHeader, tagKey }, index) => {
                    const ScheduleIcon = SCHEDULE_TYPE_ICON[task.schedule_type];
                    const meta = task.tag_id
                      ? tagsById.get(task.tag_id)
                      : undefined;
                    const isDateSpecific = task.schedule_type === "date_specific";
                    const completed =
                      isDateSpecific && task.instance?.status === "completed";
                    const completing = completingId === task.id;
                    return (
                      <React.Fragment key={task.id}>
                        {showHeader && (
                          <TagGroupHeader
                            tag={meta ?? null}
                            untagged={tagKey === UNTAGGED_KEY}
                          />
                        )}
                        <TableRow
                          className="group transition-colors hover:bg-muted/50 border-b border-border last:border-0"
                        >
                          <TableCell className="py-4 px-4 text-sm text-muted-foreground w-12">
                            {start + index + 1}
                          </TableCell>
                          <TableCell className="py-4 px-4 w-[70%] align-top">
                            <div className="flex items-start gap-3 min-w-0">
                              {isDateSpecific && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCompletion(task, !completed)
                                  }
                                  disabled={!canComplete || completing}
                                  className={cn(
                                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                                    completed
                                      ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                                      : "text-muted-foreground hover:text-foreground",
                                    (!canComplete || completing) &&
                                      "cursor-not-allowed opacity-60",
                                  )}
                                  title={
                                    !canComplete
                                      ? "You don't have permission to complete tasks"
                                      : completed
                                        ? "Reopen task"
                                        : "Mark task complete"
                                  }
                                  aria-label={
                                    completed
                                      ? "Reopen task"
                                      : "Mark task complete"
                                  }
                                >
                                  {completed ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : (
                                    <Circle className="h-5 w-5" />
                                  )}
                                </button>
                              )}
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "font-medium text-sm text-foreground break-words whitespace-normal",
                                    completed &&
                                      "line-through text-muted-foreground",
                                  )}
                                >
                                  {task.title}
                                </p>
                                {task.category_id && (
                                  <p className="text-xs text-muted-foreground break-words whitespace-normal">
                                    {task.category_id}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                              <ScheduleIcon className="h-3.5 w-3.5" />
                              {SCHEDULE_TYPE_LABEL[task.schedule_type]}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                                PRIORITY_BADGE[task.priority].className,
                              )}
                            >
                              {PRIORITY_BADGE[task.priority].label}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="table-action-btn"
                                    title="Actions"
                                    aria-label="Actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    onClick={() => setViewingTask(task)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </DropdownMenuItem>
                                  {isDateSpecific && canComplete && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setCompletion(task, !completed)
                                      }
                                      disabled={completing}
                                    >
                                      {completed ? (
                                        <>
                                          <RotateCcw className="mr-2 h-4 w-4" />
                                          Reopen
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="mr-2 h-4 w-4" />
                                          Mark complete
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {canToggle && (
                                    <DropdownMenuItem
                                      onClick={() => onToggle(task)}
                                      disabled={togglingId === task.id}
                                    >
                                      {task.status === "Active" ? (
                                        <>
                                          <PowerOff className="mr-2 h-4 w-4" />
                                          Deactivate
                                        </>
                                      ) : (
                                        <>
                                          <Power className="mr-2 h-4 w-4" />
                                          Activate
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                  )}
                                  {canUpdate && (
                                    <DropdownMenuItem
                                      onClick={() => openEdit(task)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteId(task.id)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <MasterPagination
          start={start}
          end={end}
          totalItems={groupedSorted.length}
          currentPage={currentPage}
          totalPages={totalPages}
          empty={pageData.length === 0}
          onPrev={goPrev}
          onNext={goNext}
          onPageChange={setCurrentPage}
        />
      </div>

      <TaskFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        tags={tags}
        onManageTags={() => setManageTagsOpen(true)}
        onSaved={fetchTasks}
      />

      <ManageTagsModal
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        onChanged={onTagsChanged}
      />

      <TaskViewDialog
        task={viewingTask}
        tag={
          viewingTask?.tag_id ? tagsById.get(viewingTask.tag_id) ?? null : null
        }
        onClose={() => setViewingTask(null)}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Delete task"
        description="This task and its schedule will be removed. Existing daily completion records remain in the database for audit."
        actionLabel={deleting ? "Deleting…" : "Delete"}
        variant="destructive"
        loading={deleting}
        onAction={confirmDelete}
      />

      <AlertDialog
        open={!!deactivateTask}
        onOpenChange={(o) => {
          if (!o) setDeactivateTask(null);
        }}
        title="Deactivate task"
        description="This task will stop appearing in Today's Tasks until you reactivate it. Existing completion records remain unchanged."
        actionLabel={
          togglingId === deactivateTask?.id ? "Deactivating…" : "Deactivate"
        }
        variant="destructive"
        loading={togglingId === deactivateTask?.id}
        onAction={confirmDeactivate}
      />
    </div>
  );
}

// ─── Group header row ──────────────────────────────────────────────────

function TagGroupHeader({
  tag,
  untagged,
}: {
  tag: TaskTag | null;
  untagged: boolean;
}) {
  return (
    <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
      <TableCell
        colSpan={NUM_COLUMNS}
        className="py-2 px-4 text-xs font-semibold uppercase tracking-wide"
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: untagged ? "#9ca3af" : tag?.color ?? "#9ca3af" }}
          />
          <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground">
            {untagged ? UNTAGGED_LABEL : tag?.name ?? UNTAGGED_LABEL}
          </span>
        </span>
      </TableCell>
    </TableRow>
  );
}

// ─── View dialog ───────────────────────────────────────────────────────
function TaskViewDialog({
  task,
  tag,
  onClose,
}: {
  task: Task | null;
  tag: TaskTag | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {task?.title ?? "Task"}
          </DialogTitle>
        </DialogHeader>
        {task && (
          <div className="space-y-3 text-sm">
            {task.description && (
              <p className="text-foreground/90 whitespace-pre-wrap">
                {task.description}
              </p>
            )}
            <Row
              label="Priority"
              value={PRIORITY_BADGE[task.priority].label}
            />
            <Row
              label="Schedule"
              value={`${SCHEDULE_TYPE_LABEL[task.schedule_type]} — ${formatScheduleSummary(task)}`}
            />
            {task.reminder_time && (
              <Row label="Reminder" value={task.reminder_time} />
            )}
            {task.category_id && (
              <Row label="Category" value={task.category_id} />
            )}
            <Row
              label="Tag"
              value={
                tag ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    <TagIcon className="h-3 w-3" />
                    {tag.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Untagged</span>
                )
              }
            />
            <Row label="Status" value={task.status} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground text-right">
        {value}
      </span>
    </div>
  );
}
