"use client";

/**
 * BoardFormModal — create / edit a board (title, description, visibility,
 * background, favourite). Slim form, single column. Used by the boards
 * list page and the board detail "Settings" menu.
 */

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { BOARD_BACKGROUNDS } from "@/types/project";
import type { Board, BoardVisibility } from "@/types/project";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board | null;
  onSaved: (board: Board) => void;
}

const VISIBILITY_OPTIONS: Array<{
  value: BoardVisibility;
  label: string;
  hint: string;
}> = [
  {
    value: "private",
    label: "Private",
    hint: "Only invited members can access this board.",
  },
  {
    value: "team",
    label: "Team",
    hint: "Anyone in the workspace can view and edit.",
  },
  {
    value: "public",
    label: "Public",
    hint: "Anyone in the workspace can view (read-only).",
  },
];

export function BoardFormModal({ open, onOpenChange, board, onSaved }: Props) {
  const isEdit = !!board;
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [visibility, setVisibility] = React.useState<BoardVisibility>("team");
  const [background, setBackground] = React.useState("emerald");
  const [favorite, setFavorite] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(board?.title ?? "");
      setDescription(board?.description ?? "");
      setVisibility((board?.visibility as BoardVisibility) ?? "team");
      setBackground(board?.background ?? "emerald");
      setFavorite(board?.is_favorite ?? false);
    }
  }, [open, board]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Board title is required");
      return;
    }
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/projects/boards/${board!.id}`
        : "/api/projects/boards";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description,
          visibility,
          background,
          is_favorite: favorite,
        }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Board;
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to save board");
        return;
      }
      toast.success(isEdit ? "Board updated" : "Board created");
      onSaved(json.data as Board);
      onOpenChange(false);
    } catch (err) {
      console.error("save board", err);
      toast.error("Failed to save board");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit board" : "Create new board"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the board's metadata."
              : "Spin up a new project. Default lists will be created for you."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q3 product launch"
              maxLength={160}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional. What's this board for?"
              maxLength={4000}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Cover
            </label>
            <div className="flex flex-wrap gap-2">
              {BOARD_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.key}
                  type="button"
                  onClick={() => setBackground(bg.key)}
                  title={bg.label}
                  className={cn(
                    "relative h-12 w-20 rounded-xl ring-2 ring-offset-2 ring-offset-background transition-all overflow-hidden",
                    background === bg.key
                      ? "ring-primary scale-[1.02]"
                      : "ring-transparent hover:ring-border",
                  )}
                  style={{ background: bg.preview }}
                >
                  <span className="absolute inset-0 bg-black/10" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Visibility
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {VISIBILITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors",
                    visibility === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFavorite((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              favorite
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            <Star
              className={cn("h-4 w-4", favorite && "fill-amber-500")}
            />
            {favorite ? "Favorited" : "Mark as favorite"}
          </button>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
