"use client";

/**
 * KanbanList — a single column on the board. Owns its inline "+ Add card"
 * composer and forwards drag/drop intents up to the parent board so the
 * parent can mutate the canonical lists/cards arrays.
 */

import * as React from "react";
import { Plus, MoreHorizontal, Pencil, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BoardList, Card as CardModel } from "@/types/project";

import { KanbanCard } from "./KanbanCard";

interface Props {
  list: BoardList;
  cards: CardModel[];
  canEdit: boolean;
  draggingCardId: string | null;
  hoverInfo: { listId: string; index: number } | null;
  onOpenCard: (id: string) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onRenameList: (listId: string, title: string) => Promise<void>;
  onArchiveList: (listId: string) => Promise<void>;
  // drag wiring
  onCardDragStart: (cardId: string, sourceListId: string) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (
    e: React.DragEvent<HTMLDivElement>,
    listId: string,
    index: number,
  ) => void;
  onCardDrop: (listId: string, index: number) => void;
  // list reorder
  onListDragStart: (listId: string) => void;
  onListDragOver: (e: React.DragEvent<HTMLDivElement>, listId: string) => void;
  onListDrop: (listId: string) => void;
  onListDragEnd: () => void;
}

export function KanbanList({
  list,
  cards,
  canEdit,
  draggingCardId,
  hoverInfo,
  onOpenCard,
  onAddCard,
  onRenameList,
  onArchiveList,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onListDragStart,
  onListDragOver,
  onListDrop,
  onListDragEnd,
}: Props) {
  const [composing, setComposing] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(list.title);
  const [savingCard, setSavingCard] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (composing) composerRef.current?.focus();
  }, [composing]);

  const submitNewCard = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    setSavingCard(true);
    try {
      await onAddCard(list.id, title);
      setDraftTitle("");
      // keep composer open so the user can keep typing — Trello-style
      composerRef.current?.focus();
    } finally {
      setSavingCard(false);
    }
  };

  const submitRename = async () => {
    const t = renameValue.trim();
    if (!t || t === list.title) {
      setRenaming(false);
      setRenameValue(list.title);
      return;
    }
    await onRenameList(list.id, t);
    setRenaming(false);
  };

  const isHoverEnd =
    hoverInfo && hoverInfo.listId === list.id && hoverInfo.index === cards.length;

  return (
    <div
      className="kanban-column flex w-72 sm:w-80 shrink-0 flex-col"
      draggable={canEdit && !composing && !renaming}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("application/x-frogtask-list", list.id);
        e.dataTransfer.effectAllowed = "move";
        onListDragStart(list.id);
      }}
      onDragEnd={onListDragEnd}
      onDragOver={(e) => onListDragOver(e, list.id)}
      onDrop={() => onListDrop(list.id)}
    >
      <div className="flex flex-col rounded-2xl bg-muted/40 dark:bg-muted/30 backdrop-blur p-2 max-h-[calc(100vh-220px)]">
        {/* Header */}
        <div className="flex items-center gap-2 px-1.5 pb-2">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setRenameValue(list.title);
                }
              }}
              className="flex-1 rounded-md bg-card px-2 py-1 text-sm font-semibold text-foreground border border-primary outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => canEdit && setRenaming(true)}
              className="flex-1 text-left text-sm font-semibold text-foreground truncate hover:bg-card/80 rounded-md px-2 py-1 transition-colors"
            >
              {list.title}
            </button>
          )}
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            {cards.length}
          </span>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="List options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onArchiveList(list.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="mr-2 h-4 w-4" /> Archive list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Cards scroll area */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 px-1.5 pb-1"
          onDragOver={(e) => {
            // allow dropping at the end if we're past the last card
            if (cards.length === 0) {
              onCardDragOver(e, list.id, 0);
            }
          }}
          onDrop={() => {
            if (cards.length === 0) onCardDrop(list.id, 0);
          }}
        >
          {cards.map((c, idx) => {
            const showInsertBefore =
              hoverInfo &&
              hoverInfo.listId === list.id &&
              hoverInfo.index === idx;
            return (
              <React.Fragment key={c.id}>
                {showInsertBefore && (
                  <div className="h-1.5 -my-0.5 rounded-full bg-primary/30" />
                )}
                <KanbanCard
                  card={c}
                  onOpen={() => onOpenCard(c.id)}
                  isDragging={draggingCardId === c.id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData("application/x-frogtask-card", c.id);
                    e.dataTransfer.effectAllowed = "move";
                    onCardDragStart(c.id, list.id);
                  }}
                  onDragEnd={onCardDragEnd}
                  onDragOver={(e) => onCardDragOver(e, list.id, idx)}
                  onDrop={() => onCardDrop(list.id, idx)}
                />
              </React.Fragment>
            );
          })}
          {isHoverEnd && (
            <div className="h-1.5 -my-0.5 rounded-full bg-primary/30" />
          )}

          {/* Composer / Add button */}
          {composing ? (
            <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
              <Textarea
                ref={composerRef}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitNewCard();
                  }
                  if (e.key === "Escape") {
                    setComposing(false);
                    setDraftTitle("");
                  }
                }}
                placeholder="Enter card title…"
                className="min-h-[60px] text-sm"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={submitNewCard}
                  disabled={savingCard || !draftTitle.trim()}
                >
                  Add card
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setComposing(false);
                    setDraftTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : canEdit ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className={cn(
                "w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors",
                "hover:bg-card hover:text-foreground",
              )}
            >
              <Plus className="mr-1 inline h-4 w-4 align-middle" />
              Add a card
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
