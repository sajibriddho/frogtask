"use client";

/**
 * Calendar — month view of cards with due dates across every accessible
 * board. Click a date with cards to expand; click a card to navigate
 * directly into the board (with the drawer auto-opened — see
 * `?card=...` query the board page reads).
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";

import { ProjectsTabs } from "../_components/ProjectsTabs";
import {
  PRIORITY_DOT_CLASS,
  PRIORITY_LABEL,
  type CardPriority,
} from "@/types/project";

interface CalEntry {
  id: string;
  board_id: string;
  board_title: string;
  board_background: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  priority: CardPriority;
  labels: Array<{ label_id: string; name: string; color: string }>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function shiftMonth(d: Date, by: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + by, 1);
}

export default function CalendarPage() {
  const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = React.useState<CalEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(cursor);
      const end = endOfMonth(cursor);
      // Pad a week before/after so neighbouring-month cells aren't blank.
      const rangeStart = new Date(start);
      rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
      const rangeEnd = new Date(end);
      rangeEnd.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()));

      const res = await fetch(
        `/api/projects/calendar?from=${isoDay(rangeStart)}&to=${isoDay(rangeEnd)}`,
        { cache: "no-store" },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: CalEntry[];
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to load calendar");
        return;
      }
      setEntries(json.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const cells = React.useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const grid: Array<{ date: Date; inMonth: boolean }> = [];
    const first = new Date(start);
    first.setDate(first.getDate() - first.getDay());
    const last = new Date(end);
    last.setDate(last.getDate() + (6 - last.getDay()));
    const cur = new Date(first);
    while (cur <= last) {
      grid.push({
        date: new Date(cur),
        inMonth: cur.getMonth() === cursor.getMonth(),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return grid;
  }, [cursor]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalEntry[]>();
    for (const e of entries) {
      if (!e.due_date) continue;
      const key = isoDay(new Date(e.due_date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries]);

  const todayKey = isoDay(new Date());
  const monthLabel = cursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <ProjectsTabs />

      <Card className="mb-4 border-border">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight">{monthLabel}</h1>
              <p className="text-[11px] text-muted-foreground">
                Cards with a due date in this period
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor((c) => shiftMonth(c, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setCursor(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor((c) => shiftMonth(c, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border overflow-hidden">
        <CardContent className="p-0">
          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-1 py-2 sm:px-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center sm:text-left"
              >
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 sm:h-28 border-r border-b border-border bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const key = isoDay(cell.date);
                const items = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[64px] sm:min-h-[130px] border-r border-b border-border p-1 sm:p-1.5 last-of-type:border-r-0",
                      !cell.inMonth && "bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : cell.inMonth
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                      {items.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {items.length}
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:block mt-1 space-y-1">
                      {items.slice(0, 3).map((c) => {
                        const overdue =
                          !c.completed_at &&
                          new Date(c.due_date as string) <
                            new Date(new Date().toDateString());
                        return (
                          <Link
                            key={c.id}
                            href={`/projects/${c.board_id}?card=${c.id}`}
                            className={cn(
                              "block truncate rounded-md px-1.5 py-1 text-[11px] font-medium hover:bg-muted",
                              overdue
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                : "bg-muted text-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
                                PRIORITY_DOT_CLASS[c.priority],
                              )}
                            />
                            {c.title}
                          </Link>
                        );
                      })}
                      {items.length > 3 && (
                        <span className="block px-1.5 text-[10px] text-muted-foreground">
                          +{items.length - 3} more
                        </span>
                      )}
                    </div>
                    {items.length > 0 && (
                      <div className="sm:hidden mt-1 flex flex-wrap gap-0.5">
                        {items.slice(0, 4).map((c) => (
                          <span
                            key={c.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              PRIORITY_DOT_CLASS[c.priority],
                            )}
                            aria-hidden
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          Overdue items shown in red
        </span>
        {(["low", "medium", "high", "urgent"] as CardPriority[]).map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 rounded-full", PRIORITY_DOT_CLASS[p])}
            />
            {PRIORITY_LABEL[p]}
          </span>
        ))}
        <Badge variant="outline" className="ml-auto rounded-full">
          {entries.length} cards
        </Badge>
      </div>
    </div>
  );
}
