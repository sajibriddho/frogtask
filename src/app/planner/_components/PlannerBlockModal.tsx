"use client";

/**
 * PlannerBlockModal — create/edit a single weekly planner block.
 *
 * Captures: weekday, time range, title, description, color, priority.
 * The form is the one place a user composes their week, so it intentionally
 * surfaces every field with a clear inline preview.
 */

import * as React from "react";
import { toast } from "sonner";
import { Clock, Sparkles, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import type { PlannerBlock, PlannerPriority } from "@/types/planner";
import type { Weekday } from "@/types/task";

const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string; short: string }> =
  [
    { value: 0, label: "Sunday", short: "Sun" },
    { value: 1, label: "Monday", short: "Mon" },
    { value: 2, label: "Tuesday", short: "Tue" },
    { value: 3, label: "Wednesday", short: "Wed" },
    { value: 4, label: "Thursday", short: "Thu" },
    { value: 5, label: "Friday", short: "Fri" },
    { value: 6, label: "Saturday", short: "Sat" },
  ];

const PRIORITY_OPTIONS: Array<{
  value: PlannerPriority;
  label: string;
  className: string;
}> = [
  {
    value: "low",
    label: "Low",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    value: "medium",
    label: "Medium",
    className:
      "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    value: "high",
    label: "High",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
];

const COLOR_SWATCHES = [
  "#059669", // emerald
  "#2563eb", // blue
  "#9333ea", // violet
  "#db2777", // pink
  "#ea580c", // orange
  "#ca8a04", // amber
  "#0891b2", // cyan
  "#475569", // slate
];

interface PlannerBlockModalProps {
  open: boolean;
  block: PlannerBlock | null;
  defaultWeekday?: Weekday;
  defaultStartTime?: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  weekday: Weekday;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  color: string;
  priority: PlannerPriority;
}

const EMPTY_FORM = (
  weekday: Weekday = 1,
  startTime = "09:00",
): FormState => ({
  weekday,
  start_time: startTime,
  end_time: addHourTo(startTime),
  title: "",
  description: "",
  color: COLOR_SWATCHES[0],
  priority: "medium",
});

function addHourTo(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const nextH = Math.min(23, h + 1);
  return `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function PlannerBlockModal({
  open,
  block,
  defaultWeekday,
  defaultStartTime,
  canCreate,
  canUpdate,
  canDelete,
  onClose,
  onSaved,
}: PlannerBlockModalProps) {
  const isEdit = !!block;
  const [form, setForm] = React.useState<FormState>(
    EMPTY_FORM(defaultWeekday, defaultStartTime),
  );
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (block) {
      setForm({
        weekday: block.weekday,
        start_time: block.start_time,
        end_time: block.end_time,
        title: block.title,
        description: block.description ?? "",
        color: block.color || COLOR_SWATCHES[0],
        priority: block.priority,
      });
    } else {
      setForm(EMPTY_FORM(defaultWeekday, defaultStartTime));
    }
  }, [open, block, defaultWeekday, defaultStartTime]);

  const disabledSave = isEdit ? !canUpdate : !canCreate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabledSave) return;
    if (!form.title.trim()) {
      toast.error("Please give this block a title");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("End time must be after start time");
      return;
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/planner/blocks/${block!.id}`
        : "/api/planner/blocks";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to save planner block");
        return;
      }
      toast.success(isEdit ? "Block updated" : "Added to your plan");
      onSaved();
      onClose();
    } catch (err) {
      console.error("save planner block", err);
      toast.error("Failed to save planner block");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!block) return;
    if (!canDelete) return;
    if (
      !window.confirm(
        `Remove "${block.title}" from every ${WEEKDAY_OPTIONS[block.weekday].label}?`,
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/planner/blocks/${block.id}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to delete planner block");
        return;
      }
      toast.success("Block removed");
      onSaved();
      onClose();
    } catch (err) {
      console.error("delete planner block", err);
      toast.error("Failed to delete planner block");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isEdit ? "Edit planner block" : "Plan a block"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            This block will appear every week on the weekday you pick.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="planner-title">What will you do?</Label>
            <Input
              id="planner-title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Deep work — write the proposal"
              maxLength={160}
              autoFocus
              required
            />
          </div>

          {/* Weekday */}
          <div className="space-y-1.5">
            <Label>Day of the week</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_OPTIONS.map((d) => {
                const active = form.weekday === d.value;
                return (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() =>
                      setForm((f) => ({ ...f, weekday: d.value }))
                    }
                    className={cn(
                      "rounded-xl py-2 text-xs font-semibold transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="planner-start"
                className="flex items-center gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                From
              </Label>
              <Input
                id="planner-start"
                type="time"
                value={form.start_time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_time: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="planner-end"
                className="flex items-center gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                To
              </Label>
              <Input
                id="planner-end"
                type="time"
                value={form.end_time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_time: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => {
                const active = form.priority === p.value;
                return (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() =>
                      setForm((f) => ({ ...f, priority: p.value }))
                    }
                    className={cn(
                      "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                      active
                        ? `${p.className} ring-2 ring-primary/40`
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => {
                const active = form.color === c;
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    aria-label={`Color ${c}`}
                    className={cn(
                      "h-8 w-8 rounded-full transition-transform",
                      active
                        ? "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="planner-desc">Notes (optional)</Label>
            <Textarea
              id="planner-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Why does this matter? What does done look like?"
              maxLength={1000}
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            {isEdit && canDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Removing…" : "Remove"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || disabledSave}>
              {saving
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                  ? "Save changes"
                  : "Add to plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
