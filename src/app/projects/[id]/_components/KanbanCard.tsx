"use client";

/**
 * KanbanCard — the small clickable card that lives inside a list. Shows
 * cover stripe, labels, title, members, due date, and progress bits
 * (checklist + comments + attachments). Designed to stay readable when
 * the column gets dense.
 */

import * as React from "react";
import {
  CalendarClock,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Flag,
  Loader2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PRIORITY_DOT_CLASS,
  PRIORITY_LABEL,
  type Card as CardModel,
} from "@/types/project";

interface Props {
  card: CardModel;
  onOpen: () => void;
  isDragging?: boolean;
  // drag handlers — wired by KanbanList.
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

function dueLabel(due: string | null | undefined): {
  label: string;
  tone: "neutral" | "warn" | "danger" | "ok";
} | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dueStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (dueStart.getTime() - todayStart.getTime()) / 86400_000,
  );

  const fmt = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays < 0) return { label: fmt, tone: "danger" };
  if (diffDays === 0) return { label: "Today", tone: "warn" };
  if (diffDays === 1) return { label: "Tomorrow", tone: "warn" };
  if (diffDays <= 3) return { label: fmt, tone: "warn" };
  return { label: fmt, tone: "neutral" };
}

const dueToneClass: Record<"neutral" | "warn" | "danger" | "ok", string> = {
  neutral:
    "bg-muted text-muted-foreground",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export function KanbanCard({
  card,
  onOpen,
  isDragging,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const due = card.completed_at ? null : dueLabel(card.due_date);
  const isCompleted = !!card.completed_at;
  const checklistText =
    card.checklist_total && card.checklist_total > 0
      ? `${card.checklist_done ?? 0}/${card.checklist_total}`
      : null;

  // Optimistic placeholder cards (e.g. mid-duplicate) carry `_pending`.
  // We disable interaction, dim the body, and overlay a spinner so the
  // user sees the new card materialising right where it'll land.
  const isPending = !!card._pending;

  return (
    <div
      role="button"
      tabIndex={isPending ? -1 : 0}
      onClick={isPending ? undefined : onOpen}
      onKeyDown={(e) => {
        if (isPending) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      draggable={draggable && !isPending}
      onDragStart={isPending ? undefined : onDragStart}
      onDragEnd={isPending ? undefined : onDragEnd}
      onDragOver={isPending ? undefined : onDragOver}
      onDrop={isPending ? undefined : onDrop}
      aria-busy={isPending}
      className={cn(
        "group relative rounded-xl border border-border bg-card p-2.5 shadow-sm transition-all",
        !isPending &&
          "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30",
        isPending &&
          "cursor-wait border-dashed border-primary/40 ring-1 ring-primary/10",
        isDragging && "kanban-card-dragging",
      )}
    >
      {isPending && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/85 backdrop-blur-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg ring-2 ring-primary/30">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
            Duplicating…
          </span>
        </div>
      )}
      {card.cover && (
        <div
          className="-m-2.5 mb-2 h-2 rounded-t-xl"
          style={{ background: card.cover }}
          aria-hidden
        />
      )}

      {/* Labels */}
      {card.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.labels.slice(0, 5).map((l) => (
            <span
              key={l.label_id}
              className="inline-flex h-1.5 w-8 rounded-full"
              style={{ background: l.color }}
              title={l.name}
            />
          ))}
          {card.labels.length > 5 && (
            <span className="text-[10px] font-medium text-muted-foreground">
              +{card.labels.length - 5}
            </span>
          )}
        </div>
      )}

      <p
        className={cn(
          "text-sm font-medium leading-snug text-foreground",
          isCompleted && "line-through text-muted-foreground",
        )}
      >
        {card.title}
      </p>

      {(due || checklistText || card.comment_count || card.attachment_count) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          {due && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
                dueToneClass[due.tone],
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {due.label}
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Done
            </span>
          )}
          {checklistText && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CheckSquare className="h-3 w-3" />
              {checklistText}
            </span>
          )}
          {card.comment_count ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {card.comment_count}
            </span>
          ) : null}
          {card.attachment_count ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {card.attachment_count}
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT_CLASS[card.priority])} />
            <Flag className="h-3 w-3" />
            <span className="sr-only">Priority {PRIORITY_LABEL[card.priority]}</span>
          </span>
        </div>
      )}

      {card.members.length > 0 && (
        <div className="mt-2 flex -space-x-1.5">
          {card.members.slice(0, 4).map((m) => (
            <span
              key={m.user_id}
              title={m.user_name}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-primary to-secondary text-[10px] font-semibold text-white shadow"
            >
              {m.user_name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          ))}
          {card.members.length > 4 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
              +{card.members.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
