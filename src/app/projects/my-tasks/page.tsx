"use client";

/**
 * My Tasks — every card across every accessible board where the caller
 * is an assignee. Filter chips switch between Today / Upcoming / Overdue
 * / Completed; the board / priority pickers further narrow the list.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckSquare,
  CalendarClock,
  Filter,
  AlertTriangle,
  Sparkles,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";

import { ProjectsTabs } from "../_components/ProjectsTabs";
import { BoardCover } from "../_components/BoardCover";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABEL,
  type CardPriority,
} from "@/types/project";

interface MyCard {
  id: string;
  board_id: string;
  board_title: string;
  board_background: string;
  list_id: string;
  title: string;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  priority: CardPriority;
  labels: Array<{ label_id: string; name: string; color: string }>;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

const PRIORITIES: CardPriority[] = ["low", "medium", "high", "urgent"];

export default function MyTasksPage() {
  const [filter, setFilter] = React.useState("all");
  const [priority, setPriority] = React.useState<CardPriority | "">("");
  const [search, setSearch] = React.useState("");
  const [list, setList] = React.useState<MyCard[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (priority) params.set("priority", priority);
      const res = await fetch(`/api/projects/my-tasks?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: MyCard[];
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to load tasks");
        return;
      }
      setList(json.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [filter, priority]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }, [list, search]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, MyCard[]>();
    for (const c of filtered) {
      const key = c.board_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([boardId, cards]) => ({
      boardId,
      boardTitle: cards[0].board_title,
      boardBackground: cards[0].board_background,
      cards,
    }));
  }, [filtered]);

  const todayCount = list.filter((c) => {
    if (!c.due_date || c.completed_at) return false;
    const d = new Date(c.due_date);
    const t = new Date();
    return (
      d.getFullYear() === t.getFullYear() &&
      d.getMonth() === t.getMonth() &&
      d.getDate() === t.getDate()
    );
  }).length;
  const overdueCount = list.filter((c) => {
    if (!c.due_date || c.completed_at) return false;
    return new Date(c.due_date) < new Date(new Date().toDateString());
  }).length;

  return (
    <div>
      <ProjectsTabs />

      <Card className="mb-4 border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-4 min-w-0">
            <span className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                My Tasks
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cards assigned to you across every board.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-card border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarClock className="inline mr-1 h-3 w-3" />
              {todayCount} due today
            </span>
            <span className="rounded-full bg-rose-100 dark:bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
              <AlertTriangle className="inline mr-1 h-3 w-3" />
              {overdueCount} overdue
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-4 border-border">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CardPriority | "")}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground border-none outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
              <CheckSquare className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold">All clear!</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              No tasks match these filters. Take a breath, then pick up
              something else.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <Card key={g.boardId} className="border-border overflow-hidden">
              <Link
                href={`/projects/${g.boardId}`}
                className="block hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <BoardCover
                    background={g.boardBackground}
                    className="h-9 w-12 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {g.boardTitle}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {g.cards.length} task{g.cards.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
              <ul className="divide-y divide-border">
                {g.cards.map((c) => {
                  const overdue =
                    c.due_date &&
                    !c.completed_at &&
                    new Date(c.due_date) <
                      new Date(new Date().toDateString());
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          c.priority === "urgent" && "bg-rose-500",
                          c.priority === "high" && "bg-amber-500",
                          c.priority === "medium" && "bg-sky-500",
                          c.priority === "low" && "bg-emerald-500",
                        )}
                      />
                      <Link
                        href={`/projects/${c.board_id}?card=${c.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p
                          className={cn(
                            "text-sm font-medium text-foreground truncate",
                            c.completed_at &&
                              "line-through text-muted-foreground",
                          )}
                        >
                          {c.title}
                        </p>
                        {c.labels.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.labels.slice(0, 4).map((l) => (
                              <span
                                key={l.label_id}
                                className="inline-flex h-1.5 w-6 rounded-full"
                                style={{ background: l.color }}
                              />
                            ))}
                          </div>
                        )}
                      </Link>
                      <Badge
                        className={cn(
                          "rounded-full",
                          PRIORITY_BADGE_CLASS[c.priority],
                        )}
                      >
                        {PRIORITY_LABEL[c.priority]}
                      </Badge>
                      {c.due_date && (
                        <span
                          className={cn(
                            "text-[11px] font-medium tabular-nums",
                            overdue
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {new Date(c.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
