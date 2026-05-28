"use client";

/**
 * Board detail page — the kanban view.
 *
 * Single API hit (`GET /api/projects/boards/:id`) hydrates everything
 * needed to render the board: lists, cards, labels and members. From
 * there we manage local state and POST a single `reorder` payload after
 * any drag completes (debounced — see saveLayout). Card detail editing
 * happens in the right-hand drawer.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  ArrowLeft,
  Star,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  Activity as ActivityIcon,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

import { ProjectsTabs } from "../_components/ProjectsTabs";
import { BoardCover } from "../_components/BoardCover";
import { BoardFormModal } from "../_components/BoardFormModal";
import type {
  ActivityLog,
  Board,
  BoardList,
  BoardMember,
  BoardRole,
  Card,
  Label,
} from "@/types/project";
import { ROLE_LABEL, backgroundFromKey } from "@/types/project";

import { KanbanList } from "./_components/KanbanList";
import { CardDetailDrawer } from "./_components/CardDetailDrawer";

interface BoardPayload {
  board: Board;
  my_role: BoardRole;
  lists: BoardList[];
  cards: Card[];
  labels: Label[];
  members: BoardMember[];
}

const ROLE_LEVEL: Record<BoardRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const boardId = params?.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { has } = usePermissions();
  const canDuplicate = has("projects.boards.duplicate");
  const canArchive = has("projects.boards.delete");
  const canUpdateMeta = has("projects.boards.update");

  const [data, setData] = React.useState<BoardPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activity, setActivity] = React.useState<ActivityLog[]>([]);
  const [showActivity, setShowActivity] = React.useState(false);
  const [editBoardOpen, setEditBoardOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  // Drag state
  const [draggingCardId, setDraggingCardId] = React.useState<string | null>(null);
  const [draggingListId, setDraggingListId] = React.useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = React.useState<{
    listId: string;
    index: number;
  } | null>(null);

  // Card drawer
  const [openCardId, setOpenCardId] = React.useState<string | null>(null);

  const myRole = data?.my_role ?? "viewer";
  const canEdit = ROLE_LEVEL[myRole] >= ROLE_LEVEL.member;

  // ── Initial load ─────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/boards/${boardId}`, {
        cache: "no-store",
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: BoardPayload;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to load board");
        router.push("/projects");
        return;
      }
      setData(json.data);
    } catch (err) {
      console.error("load board", err);
      toast.error("Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [boardId, router]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Deep-link: /projects/:id?card=:cardId opens the drawer.
  React.useEffect(() => {
    const cardParam = searchParams?.get("card");
    if (cardParam) setOpenCardId(cardParam);
  }, [searchParams]);

  // Activity poll (best-effort).
  React.useEffect(() => {
    if (!boardId || !showActivity) return;
    let cancelled = false;
    const fetchAct = async () => {
      try {
        const res = await fetch(
          `/api/projects/boards/${boardId}/activity?limit=40`,
          { cache: "no-store" },
        );
        const json = await parseJsonSafe<{
          success: boolean;
          data?: ActivityLog[];
        }>(res);
        if (!cancelled && json.success) setActivity(json.data ?? []);
      } catch {
        /* silent */
      }
    };
    void fetchAct();
    return () => {
      cancelled = true;
    };
  }, [boardId, showActivity]);

  // ── Reorder helpers ─────────────────────────────────────────────
  // Lists/cards are kept in local state. After every drag we POST the
  // resolved layout to /reorder (debounced) and don't await — the UI
  // moves optimistically.
  const layoutTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingLayout, setSavingLayout] = React.useState(false);

  const persistLayout = React.useCallback(
    (snapshot: BoardPayload) => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(async () => {
        setSavingLayout(true);
        try {
          const payload = {
            lists: snapshot.lists.map((l) => ({
              id: l.id,
              position: l.position,
              cards: snapshot.cards
                .filter((c) => c.list_id === l.id)
                .sort((a, b) => a.position - b.position)
                .map((c) => ({ id: c.id, position: c.position })),
            })),
          };
          const res = await fetch(
            `/api/projects/boards/${boardId}/reorder`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const json = await parseJsonSafe<{
            success: boolean;
            error?: string;
          }>(res);
          if (!json.success) {
            toast.error(json.error || "Layout save failed — refreshing");
            void load();
          }
        } catch (err) {
          console.error("reorder", err);
          toast.error("Layout save failed");
          void load();
        } finally {
          setSavingLayout(false);
        }
      }, 350);
    },
    [boardId, load],
  );

  // ── Handlers ────────────────────────────────────────────────────

  const onCardDragStart = (cardId: string) => {
    setDraggingCardId(cardId);
  };
  const onCardDragEnd = () => {
    setDraggingCardId(null);
    setHoverInfo(null);
  };
  const onCardDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    listId: string,
    index: number,
  ) => {
    if (!draggingCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverInfo({ listId, index });
  };
  const onCardDrop = (listId: string, index: number) => {
    if (!data || !draggingCardId) {
      setHoverInfo(null);
      return;
    }
    const cardId = draggingCardId;
    setDraggingCardId(null);
    setHoverInfo(null);

    setData((prev) => {
      if (!prev) return prev;
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card) return prev;

      // Pull out source-list cards (excluding the dragged card) sorted.
      const sourceList = prev.cards
        .filter((c) => c.list_id === card.list_id && c.id !== cardId)
        .sort((a, b) => a.position - b.position);
      const targetList =
        card.list_id === listId
          ? sourceList
          : prev.cards
              .filter((c) => c.list_id === listId && c.id !== cardId)
              .sort((a, b) => a.position - b.position);

      const before = targetList[index - 1];
      const after = targetList[index];
      const newPos =
        before && after
          ? (before.position + after.position) / 2
          : after
            ? after.position - 1024
            : before
              ? before.position + 1024
              : 1024;

      const nextCards = prev.cards.map((c) =>
        c.id === cardId
          ? { ...c, list_id: listId, position: newPos }
          : c,
      );
      const next = { ...prev, cards: nextCards };
      persistLayout(next);
      return next;
    });
  };

  const onListDragStart = (listId: string) => setDraggingListId(listId);
  const onListDragEnd = () => setDraggingListId(null);
  const onListDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    listId: string,
  ) => {
    // A list-drag over another column reorders columns; cards trigger
    // their own preventDefault path. We only handle this when the
    // active drag is a list, not a card.
    if (!draggingListId || draggingCardId) return;
    if (draggingListId === listId) return;
    e.preventDefault();
  };
  const onListDrop = (overListId: string) => {
    if (!data || !draggingListId || draggingCardId) {
      setDraggingListId(null);
      return;
    }
    const dragId = draggingListId;
    setDraggingListId(null);
    if (dragId === overListId) return;

    setData((prev) => {
      if (!prev) return prev;
      const sorted = [...prev.lists].sort((a, b) => a.position - b.position);
      const dragIdx = sorted.findIndex((l) => l.id === dragId);
      const overIdx = sorted.findIndex((l) => l.id === overListId);
      if (dragIdx === -1 || overIdx === -1) return prev;

      const reordered = sorted.slice();
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(overIdx, 0, moved);
      const repositioned = reordered.map((l, idx) => ({
        ...l,
        position: (idx + 1) * 1024,
      }));

      const next = { ...prev, lists: repositioned };
      persistLayout(next);
      return next;
    });
  };

  // ── List CRUD ──────────────────────────────────────────────────
  const [addingList, setAddingList] = React.useState(false);
  const [newListTitle, setNewListTitle] = React.useState("");
  const [savingList, setSavingList] = React.useState(false);
  const newListInput = React.useRef<HTMLInputElement>(null);

  const submitNewList = async () => {
    if (!newListTitle.trim()) return;
    setSavingList(true);
    try {
      const res = await fetch(
        `/api/projects/boards/${boardId}/lists`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newListTitle.trim() }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: BoardList;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to add list");
        return;
      }
      setData((d) =>
        d ? { ...d, lists: [...d.lists, json.data as BoardList] } : d,
      );
      setNewListTitle("");
      newListInput.current?.focus();
    } finally {
      setSavingList(false);
    }
  };
  const renameList = async (listId: string, title: string) => {
    try {
      const res = await fetch(`/api/projects/lists/${listId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to rename list");
        return;
      }
      setData((d) =>
        d
          ? {
              ...d,
              lists: d.lists.map((l) => (l.id === listId ? { ...l, title } : l)),
            }
          : d,
      );
    } catch {
      toast.error("Failed to rename list");
    }
  };
  const archiveList = async (listId: string) => {
    if (!window.confirm("Archive this list and its cards?")) return;
    try {
      const res = await fetch(`/api/projects/lists/${listId}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to archive list");
        return;
      }
      toast.success("List archived");
      setData((d) =>
        d
          ? {
              ...d,
              lists: d.lists.filter((l) => l.id !== listId),
              cards: d.cards.filter((c) => c.list_id !== listId),
            }
          : d,
      );
    } catch {
      toast.error("Failed to archive list");
    }
  };

  // ── Card CRUD (board-page level)
  const addCard = async (listId: string, title: string) => {
    try {
      const res = await fetch("/api/projects/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          list_id: listId,
          title,
        }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Card;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to add card");
        return;
      }
      setData((d) =>
        d ? { ...d, cards: [...d.cards, json.data as Card] } : d,
      );
    } catch {
      toast.error("Failed to add card");
    }
  };

  // The board used to own a `duplicateCard` helper that inserted an
  // optimistic placeholder into the kanban while the duplicate API
  // ran. It was wired to the drawer's "Card actions" dropdown — both
  // were removed together. The `_pending` flag on the Card type and
  // the spinner overlay in KanbanCard are kept so re-wiring duplicate
  // (or any other in-flight card mutation) only requires recreating
  // the placeholder logic here.

  // Favorite + duplicate + archive
  const toggleFavorite = async () => {
    if (!data) return;
    const next = !data.board.is_favorite;
    setData({ ...data, board: { ...data.board, is_favorite: next } });
    try {
      await fetch(`/api/projects/boards/${boardId}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: next }),
      });
    } catch {
      toast.error("Failed to update favorite");
    }
  };
  const duplicateBoard = async () => {
    try {
      const res = await fetch(
        `/api/projects/boards/${boardId}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ include_cards: true }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Board;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to duplicate");
        return;
      }
      toast.success("Board duplicated");
      router.push(`/projects/${(json.data as Board).id}`);
    } catch {
      toast.error("Failed to duplicate");
    }
  };
  const archiveBoard = async () => {
    try {
      const res = await fetch(`/api/projects/boards/${boardId}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to archive");
        return;
      }
      toast.success("Board archived");
      router.push("/projects");
    } catch {
      toast.error("Failed to archive");
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div>
        <ProjectsTabs />
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />
        </div>
      </div>
    );
  }

  const sortedLists = [...data.lists].sort((a, b) => a.position - b.position);

  return (
    <div>
      <ProjectsTabs />

      {/* Board hero */}
      <BoardCover
        background={data.board.background}
        className="mb-4 px-4 sm:px-6 py-4"
      >
        <div className="relative flex flex-wrap items-center gap-3 text-white">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 bg-white/15 hover:bg-white/25 text-white hover:text-white"
          >
            <Link href="/projects" aria-label="Back to boards">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {data.board.title}
            </h1>
            {data.board.description && (
              <p className="mt-0.5 text-xs sm:text-sm text-white/85 line-clamp-1">
                {data.board.description}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {savingLayout && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            )}
            <Badge className="rounded-full bg-white/20 text-white border-transparent backdrop-blur">
              {ROLE_LABEL[myRole]}
            </Badge>
            <button
              onClick={toggleFavorite}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              aria-label="Toggle favorite"
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  data.board.is_favorite && "fill-amber-300 text-amber-300",
                )}
              />
            </button>
            <button
              onClick={() => setShowActivity((v) => !v)}
              title="Toggle activity"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            >
              {showActivity ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <ActivityIcon className="h-4 w-4" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Board</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canUpdateMeta && (
                  <DropdownMenuItem onClick={() => setEditBoardOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit board
                  </DropdownMenuItem>
                )}
                {canDuplicate && (
                  <DropdownMenuItem onClick={duplicateBoard}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${boardId}/labels`}>
                    <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500 mr-2" />
                    Manage labels
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${boardId}/members`}>
                    <Eye className="mr-2 h-4 w-4" /> Manage members
                  </Link>
                </DropdownMenuItem>
                {canArchive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setArchiveOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive board
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </BoardCover>

      {/* Body: kanban + optional sidebar */}
      <div className="flex gap-4">
        {/* Kanban scroller */}
        <div className="flex-1 min-w-0">
          <div
            className="kanban-scroller flex gap-3 overflow-x-auto overflow-y-hidden pb-3"
            style={{ minHeight: "calc(100vh - 280px)" }}
          >
            {sortedLists.map((list) => {
              const listCards = data.cards
                .filter((c) => c.list_id === list.id)
                .sort((a, b) => a.position - b.position);
              return (
                <KanbanList
                  key={list.id}
                  list={list}
                  cards={listCards}
                  canEdit={canEdit}
                  draggingCardId={draggingCardId}
                  hoverInfo={hoverInfo}
                  onOpenCard={(id) => setOpenCardId(id)}
                  onAddCard={addCard}
                  onRenameList={renameList}
                  onArchiveList={archiveList}
                  onCardDragStart={onCardDragStart}
                  onCardDragEnd={onCardDragEnd}
                  onCardDragOver={onCardDragOver}
                  onCardDrop={onCardDrop}
                  onListDragStart={onListDragStart}
                  onListDragOver={onListDragOver}
                  onListDrop={onListDrop}
                  onListDragEnd={onListDragEnd}
                />
              );
            })}

            {/* Add list */}
            {canEdit && (
              <div className="kanban-column flex w-72 sm:w-80 shrink-0 flex-col">
                {addingList ? (
                  <div className="rounded-2xl bg-muted/40 dark:bg-muted/30 p-2.5 shadow-sm">
                    <input
                      ref={newListInput}
                      autoFocus
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void submitNewList();
                        if (e.key === "Escape") {
                          setAddingList(false);
                          setNewListTitle("");
                        }
                      }}
                      placeholder="List title…"
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-medium outline-none focus:border-primary"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={submitNewList}
                        disabled={savingList || !newListTitle.trim()}
                      >
                        Add list
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddingList(false);
                          setNewListTitle("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingList(true)}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors",
                      "bg-card/60 dark:bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-card",
                    )}
                  >
                    <Plus className="h-4 w-4" /> Add another list
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Activity sidebar */}
        {showActivity && (
          <aside className="hidden xl:flex w-72 shrink-0 flex-col">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ActivityIcon className="h-4 w-4 text-primary" />
                Activity
              </h3>
              <ul className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                {activity.length === 0 ? (
                  <li className="text-xs text-muted-foreground">
                    No recent activity yet.
                  </li>
                ) : (
                  activity.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: backgroundFromKey(data.board.background)
                            .split(",")[0]
                            .replace(/[^#a-z0-9]/gi, ""),
                        }}
                      />
                      <span className="flex-1">
                        <span className="text-foreground">{a.description}</span>
                        <br />
                        <span>
                          {new Date(a.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        )}
      </div>

      {/* Card detail drawer */}
      <CardDetailDrawer
        open={!!openCardId}
        onOpenChange={(o) => {
          if (!o) setOpenCardId(null);
        }}
        cardId={openCardId}
        boardId={boardId}
        lists={sortedLists.map((l) => ({ id: l.id, title: l.title }))}
        boardMembers={data.members}
        boardLabels={data.labels}
        canEdit={canEdit}
        onMutated={() => void load()}
      />

      {/* Edit board dialog */}
      <BoardFormModal
        open={editBoardOpen}
        onOpenChange={setEditBoardOpen}
        board={data.board}
        onSaved={(b) => {
          setEditBoardOpen(false);
          setData((d) => (d ? { ...d, board: b } : d));
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive board"
        description="The board will be moved to Archived. You can restore it later."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={archiveBoard}
      />
    </div>
  );
}
