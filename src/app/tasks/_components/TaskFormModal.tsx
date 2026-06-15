"use client";

/**
 * TaskFormModal — single create/edit dialog for the Task module.
 *
 * Three sections only: Task → Schedule → Options. Schedule picker offers
 * four shortcuts — Today, Specific date, Daily, Weekly — where "Today"
 * is the default and pre-fills the date so the most common case is one
 * click. Tasks are always owned by the caller; there is no assignee.
 */

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sun,
  Calendar,
  Repeat,
  CalendarDays,
  CalendarRange,
  Check,
  Tag as TagIcon,
  Infinity as InfinityIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import type { TaskTag } from "@/types/task-tag";
import {
  helperFor,
  toIsoDate,
  WEEKDAY_OPTIONS,
} from "@/lib/task-schedule";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  Weekday,
} from "@/types/task";

// ─── Schema ────────────────────────────────────────────────────────────

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const STATUSES = ["Active", "Inactive"] as const;
const SCHEDULE_TYPES = [
  "date_specific",
  "daily",
  "weekly",
  "date_range",
  "anytime",
] as const;

const formSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000),
    priority: z.enum(PRIORITIES),
    schedule_type: z.enum(SCHEDULE_TYPES),
    task_date: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    repeat_days: z.array(z.number().int().min(0).max(6)),
    reminder_time: z
      .string()
      .refine((v) => !v || /^\d{1,2}:\d{2}$/.test(v), {
        message: "Use HH:mm format",
      }),
    category_id: z.string(),
    tag_id: z.string(),
    status: z.enum(STATUSES),
  })
  .superRefine((data, ctx) => {
    // Anytime: no dates at all — server seeds start_date to today.
    if (data.schedule_type === "anytime") return;

    if (data.schedule_type === "date_specific") {
      if (!data.task_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["task_date"],
          message: "Pick the date this task will appear",
        });
      }
    } else {
      if (!data.start_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["start_date"],
          message: "Start date is required",
        });
      }
      if (
        data.start_date &&
        data.end_date &&
        new Date(data.end_date).getTime() <
          new Date(data.start_date).getTime()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["end_date"],
          message: "End date must be on or after start date",
        });
      }
      if (data.schedule_type === "weekly" && data.repeat_days.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["repeat_days"],
          message: "Pick at least one weekday",
        });
      }
      if (data.schedule_type === "date_range" && !data.end_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["end_date"],
          message: "End date is required for a date-range task",
        });
      }
    }
  });

type TaskFormValues = z.infer<typeof formSchema>;

// ─── Schedule modes (UI-only) ──────────────────────────────────────────
//
// `ScheduleMode` is the picker's UI state. It's a strict superset of
// `schedule_type` — "today" maps to schedule_type="date_specific" with
// task_date = today, and the date input is hidden. Picking any other
// mode unfolds the relevant fields.

type ScheduleMode =
  | "today"
  | "date_specific"
  | "daily"
  | "weekly"
  | "date_range"
  | "anytime";

const SCHEDULE_MODE_META: Record<
  ScheduleMode,
  {
    label: string;
    description: string;
    icon: React.ElementType;
  }
> = {
  today: {
    label: "Today",
    description: "Just today, one-off",
    icon: Sun,
  },
  date_specific: {
    label: "Pick a date",
    description: "A future one-off date",
    icon: Calendar,
  },
  daily: {
    label: "Every day",
    description: "Repeats every day",
    icon: Repeat,
  },
  weekly: {
    label: "Weekly",
    description: "Specific weekdays",
    icon: CalendarDays,
  },
  date_range: {
    label: "Date range",
    description: "Shows every day from a date to a date — check once",
    icon: CalendarRange,
  },
  anytime: {
    label: "Anytime",
    description: "No deadline — sits in your Anytime list until you check it off",
    icon: InfinityIcon,
  },
};

const MODE_ORDER: ScheduleMode[] = [
  "today",
  "date_specific",
  "daily",
  "weekly",
  "date_range",
  "anytime",
];

/** Decide which mode tile to highlight when opening an existing task. */
function deriveMode(task: Task | null): ScheduleMode {
  if (!task) return "today";
  if (task.schedule_type === "date_specific") {
    return task.task_date && toIsoDate(task.task_date) === toIsoDate(new Date())
      ? "today"
      : "date_specific";
  }
  if (task.schedule_type === "date_range") return "date_range";
  if (task.schedule_type === "anytime") return "anytime";
  return task.schedule_type;
}

// ─── Defaults / serialisers ────────────────────────────────────────────

function todayIsoDate(): string {
  return toIsoDate(new Date());
}

const EMPTY: TaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  schedule_type: "date_specific", // "today" mode → date_specific + task_date=today
  task_date: "", // hydrated to today on open
  start_date: "",
  end_date: "",
  repeat_days: [],
  reminder_time: "",
  category_id: "",
  tag_id: "",
  status: "Active",
};

function fromTask(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    schedule_type: task.schedule_type,
    task_date: task.task_date ? toIsoDate(task.task_date) : "",
    start_date: task.start_date ? toIsoDate(task.start_date) : "",
    end_date: task.end_date ? toIsoDate(task.end_date) : "",
    repeat_days: task.repeat_days ?? [],
    reminder_time: task.reminder_time ?? "",
    category_id: task.category_id ?? "",
    tag_id: task.tag_id ?? "",
    status: task.status,
  };
}

// ─── Sub-components ────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  htmlFor,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  htmlFor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={htmlFor}
          className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
          {hint && (
            <span className="ml-1 normal-case tracking-normal font-normal text-[11px] text-muted-foreground/70">
              {hint}
            </span>
          )}
        </Label>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

const PRIORITY_PALETTE: Record<
  TaskPriority,
  { active: string; idle: string }
> = {
  low: {
    active:
      "border-emerald-400 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    idle: "border-border text-muted-foreground hover:border-emerald-400",
  },
  medium: {
    active:
      "border-sky-400 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    idle: "border-border text-muted-foreground hover:border-sky-400",
  },
  high: {
    active:
      "border-amber-400 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    idle: "border-border text-muted-foreground hover:border-amber-400",
  },
  urgent: {
    active:
      "border-rose-400 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    idle: "border-border text-muted-foreground hover:border-rose-400",
  },
};

function PriorityPicker({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (v: TaskPriority) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {PRIORITIES.map((p) => {
        const active = value === p;
        const palette = PRIORITY_PALETTE[p];
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "rounded-xl border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
              active ? palette.active : palette.idle,
            )}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleModePicker({
  value,
  onChange,
}: {
  value: ScheduleMode;
  onChange: (v: ScheduleMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
      {MODE_ORDER.map((mode) => {
        const meta = SCHEDULE_MODE_META[mode];
        const ModeIcon = meta.icon;
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            title={meta.description}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <ModeIcon className="h-3.5 w-3.5" />
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TagPicker({
  tags,
  value,
  onChange,
}: {
  tags: TaskTag[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? (tags.find((t) => t.id === value) ?? null) : null;
  // Show selected tag even if it was filtered/deleted upstream — keeps the
  // edit form honest about what's stored.
  const selectedMissing = value !== "" && !selected;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange("")}
        aria-pressed={value === ""}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          value === ""
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
      >
        {value === "" ? <Check className="h-3 w-3" /> : null}
        No tag
      </button>

      {tags.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            title={t.name}
            className={cn(
              "inline-flex max-w-[180px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-transparent text-white"
                : "border-border bg-card text-foreground hover:border-foreground/30",
            )}
            style={
              active
                ? { backgroundColor: t.color }
                : undefined
            }
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                active ? "bg-white/80" : "",
              )}
              style={active ? undefined : { backgroundColor: t.color }}
              aria-hidden
            />
            <span className="truncate">{t.name}</span>
          </button>
        );
      })}

      {selectedMissing && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-destructive/50 px-2.5 py-1 text-xs font-medium text-destructive">
          <TagIcon className="h-3 w-3" />
          Tag missing
        </span>
      )}
    </div>
  );
}

function WeekdayPicker({
  value,
  onChange,
}: {
  value: Weekday[];
  onChange: (v: Weekday[]) => void;
}) {
  const toggle = (day: Weekday) => {
    if (value.includes(day)) onChange(value.filter((d) => d !== day));
    else onChange([...value, day].sort((a, b) => a - b) as Weekday[]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAY_OPTIONS.map((w) => {
        const active = value.includes(w.value);
        return (
          <button
            key={w.value}
            type="button"
            onClick={() => toggle(w.value)}
            className={cn(
              "min-w-[52px] rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
            aria-pressed={active}
          >
            {w.short}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing task to edit, or null to create. */
  task: Task | null;
  /** Caller-supplied tag list (refreshed by the All Tasks page). */
  tags: TaskTag[];
  /** Open the manage-tags modal — surfaced inline from the tag picker. */
  onManageTags: () => void;
  /** Called after a successful save (caller refetches the list). */
  onSaved: () => void;
}

export function TaskFormModal({
  open,
  onOpenChange,
  task,
  tags,
  onManageTags,
  onSaved,
}: TaskFormModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [mode, setMode] = React.useState<ScheduleMode>("today");

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
  });

  // Hydrate when opening / when target task changes.
  React.useEffect(() => {
    if (!open) return;
    const initialMode = deriveMode(task);
    setMode(initialMode);
    if (task) {
      reset(fromTask(task));
    } else {
      // Default = Today: pre-fill schedule_type + task_date.
      reset({ ...EMPTY, schedule_type: "date_specific", task_date: todayIsoDate() });
    }
  }, [open, task, reset]);

  const scheduleType = watch("schedule_type");
  const taskDate = watch("task_date");
  const startDate = watch("start_date");
  const endDate = watch("end_date");
  const repeatDays = watch("repeat_days");
  const priority = watch("priority");
  const status = watch("status");

  /** Apply a mode click — set schedule_type / dates appropriately. */
  const handleModeChange = (next: ScheduleMode) => {
    setMode(next);
    if (next === "today") {
      setValue("schedule_type", "date_specific", { shouldValidate: false });
      setValue("task_date", todayIsoDate(), { shouldValidate: true });
      setValue("start_date", "");
      setValue("end_date", "");
      setValue("repeat_days", []);
      return;
    }
    if (next === "date_specific") {
      setValue("schedule_type", "date_specific", { shouldValidate: false });
      // Only clear the date when we came from "today" so user-edited dates survive.
      if (mode === "today") setValue("task_date", "", { shouldValidate: false });
      setValue("start_date", "");
      setValue("end_date", "");
      setValue("repeat_days", []);
      return;
    }
    if (next === "anytime") {
      // No dates — the server seeds start_date on create.
      setValue("schedule_type", "anytime", { shouldValidate: false });
      setValue("task_date", "");
      setValue("start_date", "");
      setValue("end_date", "");
      setValue("repeat_days", []);
      return;
    }
    // daily / weekly / date_range
    setValue("schedule_type", next, { shouldValidate: false });
    setValue("task_date", "");
    if (next === "daily" || next === "date_range") setValue("repeat_days", []);
  };

  const helper = React.useMemo(() => {
    if (mode === "today") return "This task will appear today only.";
    return helperFor({
      schedule_type: scheduleType,
      task_date: taskDate || null,
      start_date: startDate || null,
      end_date: endDate || null,
      repeat_days: repeatDays as Weekday[],
    });
  }, [mode, scheduleType, taskDate, startDate, endDate, repeatDays]);

  const onSubmit = async (values: TaskFormValues) => {
    setSubmitting(true);
    try {
      const isAnytime = values.schedule_type === "anytime";
      const isDateSpecific = values.schedule_type === "date_specific";
      const payload = {
        title: values.title,
        description: values.description ?? "",
        priority: values.priority,
        schedule_type: values.schedule_type,
        task_date: isDateSpecific ? values.task_date : null,
        start_date:
          isAnytime || isDateSpecific ? null : values.start_date,
        end_date:
          !isAnytime && !isDateSpecific && values.end_date
            ? values.end_date
            : null,
        repeat_days: values.schedule_type === "weekly" ? values.repeat_days : [],
        reminder_time: values.reminder_time ?? "",
        category_id: values.category_id ?? "",
        tag_id: values.tag_id ?? "",
        status: values.status,
      };

      const url = task ? `/api/tasks/${task.id}` : "/api/tasks";
      const res = await fetch(url, {
        method: task ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!data.success) {
        toast.error(data.error || "Failed to save task");
        return;
      }
      toast.success(task ? "Task updated" : "Task created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error("save task", err);
      toast.error("Failed to save task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base">
            {task ? "Edit task" : "Create a new task"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Give it a name, pick when it should show up, and you&apos;re done.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 min-h-0 flex-col"
        >
          <div className="flex-1 min-h-0 px-5 py-4 overflow-y-auto">
            <div className="space-y-4">
              <Field label="Title" required htmlFor="task-title">
                <Input
                  id="task-title"
                  autoFocus
                  {...register("title")}
                  className={cn(
                    "h-11 text-base",
                    errors.title &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                <FieldError msg={errors.title?.message} />
              </Field>

              <Field label="Description" hint="(optional)" htmlFor="task-description">
                <Textarea
                  id="task-description"
                  rows={3}
                  {...register("description")}
                />
              </Field>

              <Field label="Priority">
                <PriorityPicker
                  value={priority}
                  onChange={(v) =>
                    setValue("priority", v, { shouldValidate: true })
                  }
                />
              </Field>

              <Field label="When">
                <ScheduleModePicker value={mode} onChange={handleModeChange} />

                {mode === "date_specific" && (
                  <Input
                    id="task-date"
                    type="date"
                    {...register("task_date")}
                    className={cn(
                      "mt-2",
                      errors.task_date &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                )}
                <FieldError msg={errors.task_date?.message} />

                {(mode === "daily" ||
                  mode === "weekly" ||
                  mode === "date_range") && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <Input
                        id="start-date"
                        type="date"
                        aria-label={
                          mode === "date_range" ? "From date" : "Start date"
                        }
                        {...register("start_date")}
                        className={cn(
                          errors.start_date &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <FieldError msg={errors.start_date?.message} />
                    </div>
                    <div>
                      <Input
                        id="end-date"
                        type="date"
                        aria-label={
                          mode === "date_range"
                            ? "To date"
                            : "End date (optional)"
                        }
                        {...register("end_date")}
                        className={cn(
                          errors.end_date &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                      <FieldError msg={errors.end_date?.message} />
                    </div>
                  </div>
                )}

                {mode === "weekly" && (
                  <div className="mt-2">
                    <Controller
                      control={control}
                      name="repeat_days"
                      render={({ field }) => (
                        <WeekdayPicker
                          value={field.value as Weekday[]}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <FieldError
                      msg={errors.repeat_days?.message as string | undefined}
                    />
                  </div>
                )}

                {helper && (
                  <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
                )}
              </Field>

              <Field
                label="Tag"
                action={
                  <button
                    type="button"
                    onClick={onManageTags}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Manage tags
                  </button>
                }
              >
                <Controller
                  control={control}
                  name="tag_id"
                  render={({ field }) => (
                    <TagPicker
                      tags={tags}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  )}
                />
                {tags.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No tags yet — click <span className="font-medium">Manage tags</span> to add your first one.
                  </p>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Category" htmlFor="task-category">
                  <Input id="task-category" {...register("category_id")} />
                </Field>

                <Field label="Reminder" htmlFor="reminder-time">
                  <Input
                    id="reminder-time"
                    type="time"
                    {...register("reminder_time")}
                    className={cn(
                      errors.reminder_time &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  <FieldError msg={errors.reminder_time?.message} />
                </Field>

                <Field label="Status">
                  <div className="grid grid-cols-2 gap-1.5">
                    {STATUSES.map((opt) => {
                      const active = status === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setValue("status", opt as TaskStatus, {
                              shouldValidate: true,
                            })
                          }
                          className={cn(
                            "h-9 rounded-lg border text-xs font-medium transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40",
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-card px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? task
                  ? "Updating…"
                  : "Creating…"
                : task
                  ? "Update task"
                  : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
