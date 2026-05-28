"use client";

/**
 * Boards index — the entry point of the Project Management module.
 *
 * Shows a hero with quick stats, a search/filter bar, then a responsive
 * grid of board cards. Each card is a Link to `/projects/[id]`. Hover
 * reveals favourite toggle and an action menu (edit/duplicate/archive).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Star,
  LayoutGrid,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Copy,
  Pencil,
  Archive,
  Sparkles,
  Filter,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

import { ProjectsTabs } from "./_components/ProjectsTabs";
import { BoardCover } from "./_components/BoardCover";
import { BoardFormModal } from "./_components/BoardFormModal";
import type { Board } from "@/types/project";

interface Stats {
  boards_total: number;
  cards_active: number;
  cards_completed: number;
  cards_overdue: number;
  my_open: number;
}

// "all", "favorite", and "recent" are scoped to active boards — the
// API now hard-filters archived ones out unless the user explicitly
// picks the "archived" chip. See /api/projects/boards/route.ts.
const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "Active" },
  { key: "favorite", label: "Favorites" },
  { key: "recent", label: "Recent" },
  { key: "archived", label: "Archived" },
];

export default function BoardsPage() {
  const router = useRouter();
  const { has } = usePermissions();
  const canCreate = has("projects.boards.create");
  const canUpdate = has("projects.boards.update");
  const canDelete = has("projects.boards.delete");
  const canDuplicate = has("projects.boards.duplicate");

  const [boards, setBoards] = React.useState<Board[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Board | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<Board | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (filter) params.set("filter", filter);
      const [boardsRes, statsRes] = await Promise.all([
        fetch(`/api/projects/boards?${params.toString()}`, {
          cache: "no-store",
        }),
        fetch("/api/projects/stats", { cache: "no-store" }),
      ]);
      const boardsJson = await parseJsonSafe<{
        success: boolean;
        data?: Board[];
        error?: string;
      }>(boardsRes);
      const statsJson = await parseJsonSafe<{
        success: boolean;
        data?: Stats;
      }>(statsRes);
      if (boardsJson.success) setBoards(boardsJson.data ?? []);
      else toast.error(boardsJson.error || "Failed to load boards");
      if (statsJson.success) setStats(statsJson.data ?? null);
    } catch (err) {
      console.error("load boards", err);
      toast.error("Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggleFavorite = async (b: Board) => {
    // optimistic
    setBoards((prev) =>
      prev.map((p) =>
        p.id === b.id ? { ...p, is_favorite: !p.is_favorite } : p,
      ),
    );
    try {
      const res = await fetch(`/api/projects/boards/${b.id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: !b.is_favorite }),
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) throw new Error(json.error);
    } catch (err) {
      console.error("favorite", err);
      // rollback
      setBoards((prev) =>
        prev.map((p) =>
          p.id === b.id ? { ...p, is_favorite: b.is_favorite } : p,
        ),
      );
      toast.error("Failed to update favorite");
    }
  };

  const duplicate = async (b: Board) => {
    try {
      const res = await fetch(`/api/projects/boards/${b.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_cards: true }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Board;
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to duplicate");
        return;
      }
      toast.success("Board duplicated");
      await load();
    } catch (err) {
      console.error("duplicate", err);
      toast.error("Failed to duplicate");
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    try {
      const res = await fetch(
        `/api/projects/boards/${archiveTarget.id}`,
        { method: "DELETE" },
      );
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to archive");
        return;
      }
      toast.success("Board archived");
      setArchiveTarget(null);
      await load();
    } catch (err) {
      console.error("archive", err);
      toast.error("Failed to archive");
    }
  };

  return (
    <div>
      <ProjectsTabs />

      {/* Hero */}
      <Card className="mb-4 border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-4 min-w-0">
            <span className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Boards
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Organise projects into kanban boards, lists, and cards. Drag
                cards across stages to track work in real time.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canCreate && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" /> New board
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
        <StatTile
          icon={LayoutGrid}
          tone="primary"
          label="Active boards"
          value={stats?.boards_total ?? 0}
          loading={loading && !stats}
        />
        <StatTile
          icon={CheckCircle2}
          tone="emerald"
          label="Completed cards"
          value={stats?.cards_completed ?? 0}
          loading={loading && !stats}
        />
        <StatTile
          icon={Clock}
          tone="sky"
          label="Open cards"
          value={stats?.cards_active ?? 0}
          loading={loading && !stats}
        />
        <StatTile
          icon={AlertTriangle}
          tone="rose"
          label="Overdue"
          value={stats?.cards_overdue ?? 0}
          loading={loading && !stats}
        />
      </div>

      {/* Search + filter strip */}
      <Card className="mb-4 border-border">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boards…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
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
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <EmptyBoards canCreate={canCreate} onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((b) => (
            <BoardTile
              key={b.id}
              board={b}
              onOpen={() => router.push(`/projects/${b.id}`)}
              onFavorite={() => toggleFavorite(b)}
              onEdit={canUpdate ? () => setEditing(b) : undefined}
              onDuplicate={canDuplicate ? () => duplicate(b) : undefined}
              onArchive={
                canDelete && b.status === "active"
                  ? () => setArchiveTarget(b)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <BoardFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        board={null}
        onSaved={() => {
          setCreateOpen(false);
          void load();
        }}
      />
      <BoardFormModal
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        board={editing}
        onSaved={() => {
          setEditing(null);
          void load();
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
        title="Archive board"
        description={`“${archiveTarget?.title ?? ""}” will be moved to Archived. You can restore it later.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={archive}
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  tone: "primary" | "emerald" | "sky" | "rose";
  label: string;
  value: number;
  loading?: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <span
          className={cn(
            "flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl",
            tones[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="mt-1 h-7 w-12 rounded-md bg-muted/60 animate-pulse" />
          ) : (
            <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-none mt-1 text-foreground">
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BoardTile({
  board,
  onOpen,
  onFavorite,
  onEdit,
  onDuplicate,
  onArchive,
}: {
  board: Board;
  onOpen: () => void;
  onFavorite: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
}) {
  // Layout note:
  //  • The whole tile is clickable (onClick → onOpen routes via useRouter).
  //  • Right-click "Open in new tab" works because the title is also a real
  //    <Link>; we deliberately do NOT use a full-card <Link absolute inset-0>
  //    overlay — that overlay would sit on top of the favourite + 3-dot
  //    buttons and swallow their clicks (the bug that led to the dropdown
  //    never opening on the boards listing page).
  //  • The button strip uses `z-10` so even if a future overlay is added
  //    it stays above it. stopPropagation on each button prevents the tile's
  //    onClick from firing while the dropdown is being used.
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
      onClick={onOpen}
    >
      <BoardCover background={board.background} className="h-24">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            title={board.is_favorite ? "Unfavorite" : "Favorite"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/30 transition-colors"
          >
            <Star
              className={cn(
                "h-4 w-4",
                board.is_favorite && "fill-amber-300 text-amber-300",
              )}
            />
          </button>
          {(onEdit || onDuplicate || onArchive) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Board options"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/30 transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                {onEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate();
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                )}
                {onArchive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive();
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </BoardCover>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/projects/${board.id}`}
              onClick={(e) => e.stopPropagation()}
              className="block text-sm font-semibold text-foreground truncate hover:text-primary transition-colors"
            >
              {board.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
              {board.description || "No description yet."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px] font-medium uppercase tracking-wider">
              {board.visibility}
            </Badge>
            {board.status === "archived" && (
              <Badge variant="secondary" className="rounded-full">
                Archived
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2.5 tabular-nums">
            <span title="Lists">{board.list_count ?? 0} lists</span>
            <span aria-hidden>·</span>
            <span title="Cards">{board.card_count ?? 0} cards</span>
            <span aria-hidden>·</span>
            <span title="Members">{board.member_count ?? 0} members</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyBoards({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <Card className="border-border border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <LayoutGrid className="h-6 w-6" />
        </span>
        <h3 className="text-base font-semibold text-foreground">
          No boards yet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Create your first board to start organising work into kanban lists
          and cards. Default lists (Backlog, To Do, In Progress, Review, Done)
          are seeded for you.
        </p>
        {canCreate && (
          <Button onClick={onCreate} className="mt-5 rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first board
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
