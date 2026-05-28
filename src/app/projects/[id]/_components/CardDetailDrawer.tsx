"use client";

/**
 * CardDetailDrawer — full card editor.
 *
 * Slides in from the right on desktop, becomes a near-full-screen sheet
 * on mobile. Loads /api/projects/cards/:id (which returns the card +
 * checklists + comments + attachments + activity) and lets the user
 * edit just about everything Trello does:
 *
 *   • inline title, description
 *   • priority, dates, members, labels
 *   • checklists with progress
 *   • comments (own author edit/delete)
 *   • attachments (file upload via /api/uploads, plus paste-link)
 *   • duplicate, archive, hard delete (admin)
 *   • activity log
 */

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Loader2,
  CheckSquare,
  CalendarClock,
  Tag,
  Users,
  Paperclip,
  Trash2,
  Send,
  Plus,
  Flag,
  Activity as ActivityIcon,
  Image as ImageIcon,
  Link2,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABEL,
  type Card,
  type CardPriority,
  type Checklist,
  type ChecklistItem,
  type Comment,
  type Attachment,
  type ActivityLog,
  type Label,
  type BoardMember,
  type CardMember,
  LABEL_COLORS,
} from "@/types/project";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string | null;
  boardId: string;
  /** lookup of board lists for the "Move to" picker */
  lists: Array<{ id: string; title: string }>;
  /** all members on this board (for the "Assign" picker) */
  boardMembers: BoardMember[];
  /** all labels on this board */
  boardLabels: Label[];
  canEdit: boolean;
  /** Called after any successful mutation so the parent can refresh. */
  onMutated: () => void;
}

interface DetailPayload {
  card: Card;
  checklists: Checklist[];
  comments: Comment[];
  attachments: Attachment[];
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const PRIORITY_OPTIONS: CardPriority[] = ["low", "medium", "high", "urgent"];

export function CardDetailDrawer({
  open,
  onOpenChange,
  cardId,
  boardId,
  lists,
  boardMembers,
  boardLabels,
  canEdit,
  onMutated,
}: Props) {
  const { data: session } = useSession();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<DetailPayload | null>(null);
  const [activity, setActivity] = React.useState<ActivityLog[]>([]);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [descDraft, setDescDraft] = React.useState("");
  const [editingDesc, setEditingDesc] = React.useState(false);
  const [commentDraft, setCommentDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  // ── Load detail
  const reload = React.useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const [detRes, actRes] = await Promise.all([
        fetch(`/api/projects/cards/${cardId}`, { cache: "no-store" }),
        fetch(
          `/api/projects/boards/${boardId}/activity?card_id=${cardId}&limit=50`,
          { cache: "no-store" },
        ),
      ]);
      const detJson = await parseJsonSafe<{
        success: boolean;
        data?: DetailPayload;
        error?: string;
      }>(detRes);
      const actJson = await parseJsonSafe<{
        success: boolean;
        data?: ActivityLog[];
      }>(actRes);
      if (!detJson.success || !detJson.data) {
        toast.error(detJson.error || "Failed to load card");
        onOpenChange(false);
        return;
      }
      setData(detJson.data);
      setActivity(actJson.data ?? []);
      setTitleDraft(detJson.data.card.title);
      setDescDraft(detJson.data.card.description);
    } catch (err) {
      console.error("load card", err);
      toast.error("Failed to load card");
    } finally {
      setLoading(false);
    }
  }, [cardId, boardId, onOpenChange]);

  React.useEffect(() => {
    if (open && cardId) void reload();
  }, [open, cardId, reload]);

  // ── PATCH helper ──────────────────────────────────────────────────
  const patchCard = async (
    body: Record<string, unknown>,
    { silent }: { silent?: boolean } = {},
  ) => {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/projects/cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Card;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to save");
        return false;
      }
      setData((d) => (d ? { ...d, card: json.data as Card } : d));
      onMutated();
      if (!silent) toast.success("Saved");
      void reloadActivity();
      return true;
    } catch (err) {
      console.error("patch card", err);
      toast.error("Failed to save");
      return false;
    }
  };

  const reloadActivity = async () => {
    if (!cardId) return;
    try {
      const res = await fetch(
        `/api/projects/boards/${boardId}/activity?card_id=${cardId}&limit=50`,
        { cache: "no-store" },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ActivityLog[];
      }>(res);
      if (json.success) setActivity(json.data ?? []);
    } catch {
      /* silent */
    }
  };

  // ── Title / description save ──────────────────────────────────────
  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (!data) return;
    if (!t || t === data.card.title) {
      setTitleDraft(data.card.title);
      return;
    }
    await patchCard({ title: t }, { silent: true });
  };
  const saveDescription = async () => {
    if (!data) return;
    if (descDraft === data.card.description) {
      setEditingDesc(false);
      return;
    }
    const ok = await patchCard({ description: descDraft }, { silent: true });
    if (ok) setEditingDesc(false);
  };

  // ── Comments
  const submitComment = async () => {
    if (!cardId || !commentDraft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(
        `/api/projects/cards/${cardId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: commentDraft }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Comment;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to post comment");
        return;
      }
      setData((d) =>
        d ? { ...d, comments: [...d.comments, json.data as Comment] } : d,
      );
      setCommentDraft("");
      onMutated();
      void reloadActivity();
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/comments/${id}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to delete comment");
        return;
      }
      setData((d) =>
        d
          ? { ...d, comments: d.comments.filter((c) => c.id !== id) }
          : d,
      );
      onMutated();
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  // ── Checklists
  const addChecklist = async () => {
    if (!cardId) return;
    const title = window.prompt("Checklist title", "Checklist");
    if (!title) return;
    try {
      const res = await fetch(
        `/api/projects/cards/${cardId}/checklists`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Checklist;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to add checklist");
        return;
      }
      setData((d) =>
        d
          ? { ...d, checklists: [...d.checklists, json.data as Checklist] }
          : d,
      );
      onMutated();
    } catch {
      toast.error("Failed to add checklist");
    }
  };

  const addChecklistItem = async (checklistId: string, text: string) => {
    try {
      const res = await fetch(
        `/api/projects/checklists/${checklistId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ChecklistItem & { checklist_id: string };
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to add item");
        return;
      }
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          checklists: d.checklists.map((c) =>
            c.id === checklistId
              ? { ...c, items: [...c.items, json.data as ChecklistItem] }
              : c,
          ),
        };
      });
      onMutated();
    } catch {
      toast.error("Failed to add item");
    }
  };

  const toggleChecklistItem = async (
    checklistId: string,
    item: ChecklistItem,
  ) => {
    try {
      const next = !item.is_completed;
      // optimistic
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          checklists: d.checklists.map((c) =>
            c.id === checklistId
              ? {
                  ...c,
                  items: c.items.map((it) =>
                    it.id === item.id ? { ...it, is_completed: next } : it,
                  ),
                }
              : c,
          ),
        };
      });
      const res = await fetch(
        `/api/projects/checklists/${checklistId}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: next }),
        },
      );
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to toggle");
        return;
      }
      onMutated();
      void reloadActivity();
    } catch {
      toast.error("Failed to toggle");
    }
  };

  const deleteChecklistItem = async (
    checklistId: string,
    itemId: string,
  ) => {
    try {
      const res = await fetch(
        `/api/projects/checklists/${checklistId}/items/${itemId}`,
        { method: "DELETE" },
      );
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to delete");
        return;
      }
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          checklists: d.checklists.map((c) =>
            c.id === checklistId
              ? { ...c, items: c.items.filter((it) => it.id !== itemId) }
              : c,
          ),
        };
      });
      onMutated();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const deleteChecklist = async (checklistId: string) => {
    if (!window.confirm("Delete this checklist?")) return;
    try {
      const res = await fetch(`/api/projects/checklists/${checklistId}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to delete");
        return;
      }
      setData((d) =>
        d
          ? {
              ...d,
              checklists: d.checklists.filter((c) => c.id !== checklistId),
            }
          : d,
      );
      onMutated();
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ── Attachments
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const onUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cardId) return;
    setUploading(true);
    try {
      // Use existing /api/uploads endpoint to store the file. We don't
      // know the exact response shape so we accept the common
      // `{ success, data: { url } }` and `{ url }` formats.
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/uploads", { method: "POST", body: fd });
      const upJson = (await upRes.json().catch(() => ({}))) as {
        success?: boolean;
        url?: string;
        data?: { url?: string; file_url?: string };
      };
      const url =
        upJson.url ?? upJson.data?.url ?? upJson.data?.file_url ?? "";
      if (!url) {
        toast.error("Upload failed");
        return;
      }
      const att = await fetch(
        `/api/projects/cards/${cardId}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name: file.name,
            file_url: url,
            file_type: file.type,
            file_size: file.size,
          }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Attachment;
        error?: string;
      }>(att);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to attach");
        return;
      }
      setData((d) =>
        d
          ? { ...d, attachments: [json.data as Attachment, ...d.attachments] }
          : d,
      );
      onMutated();
      void reloadActivity();
    } catch (err) {
      console.error("upload", err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const attachLink = async () => {
    if (!cardId) return;
    const url = window.prompt("Paste a link URL");
    if (!url) return;
    const file_name = window.prompt("Display name", url) ?? url;
    try {
      const res = await fetch(
        `/api/projects/cards/${cardId}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_name,
            file_url: url,
            file_type: "link",
            file_size: 0,
          }),
        },
      );
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Attachment;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to attach");
        return;
      }
      setData((d) =>
        d
          ? { ...d, attachments: [json.data as Attachment, ...d.attachments] }
          : d,
      );
      onMutated();
      void reloadActivity();
    } catch {
      toast.error("Failed to attach");
    }
  };

  const deleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/attachments/${id}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to delete");
        return;
      }
      setData((d) =>
        d
          ? { ...d, attachments: d.attachments.filter((a) => a.id !== id) }
          : d,
      );
      onMutated();
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ── Card-level actions: duplicate, archive, delete
  // Note: card-level mutations (duplicate / archive / hard-delete) used
  // to live here. They moved out with the "Card actions" dropdown that
  // was removed from the drawer header. If they need a new home,
  // re-add the handlers and call `onMutated()` + `onOpenChange(false)`
  // on success — same pattern as before.

  // ── Member / Label assignment helpers ─────────────────────────────
  const toggleMember = async (m: BoardMember) => {
    if (!data) return;
    const exists = data.card.members.some((x) => x.user_id === m.user_id);
    const next: CardMember[] = exists
      ? data.card.members.filter((x) => x.user_id !== m.user_id)
      : [
          ...data.card.members,
          { user_id: m.user_id, user_name: m.user_name },
        ];
    await patchCard({ members: next }, { silent: true });
  };

  const toggleLabel = async (lbl: Label) => {
    if (!data) return;
    const exists = data.card.labels.some((x) => x.label_id === lbl.id);
    const next = exists
      ? data.card.labels.filter((x) => x.label_id !== lbl.id)
      : [
          ...data.card.labels,
          { label_id: lbl.id, name: lbl.name, color: lbl.color },
        ];
    await patchCard({ labels: next }, { silent: true });
  };

  // ── Render
  const card = data?.card;
  const checklistTotal = data
    ? data.checklists.reduce((acc, c) => acc + c.items.length, 0)
    : 0;
  const checklistDone = data
    ? data.checklists.reduce(
        (acc, c) => acc + c.items.filter((i) => i.is_completed).length,
        0,
      )
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 overflow-y-auto"
      >
        {/*
          Radix Dialog (which Sheet wraps) requires a Title for screen
          reader users — without it the console emits a warning. The
          visible title in this drawer is an inline <input>, so we render
          a visually-hidden SheetTitle for accessibility instead.
        */}
        <SheetTitle className="sr-only">
          {data?.card?.title ? `Card: ${data.card.title}` : "Card details"}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Edit card title, description, members, labels, dates, checklists,
          comments, and attachments.
        </SheetDescription>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        {loading || !card ? (
          <div className="flex h-full items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div
              className={cn(
                "relative px-5 py-4 border-b border-border",
                card.cover && "rounded-t-none",
              )}
              style={card.cover ? { background: card.cover } : undefined}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    disabled={!canEdit}
                    className={cn(
                      "w-full bg-transparent text-lg sm:text-xl font-semibold leading-tight outline-none rounded-md px-1 -mx-1",
                      card.cover ? "text-white placeholder-white/70" : "text-foreground",
                      canEdit && "hover:bg-muted/40 focus:bg-muted/60",
                    )}
                  />
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      card.cover ? "text-white/80" : "text-muted-foreground",
                    )}
                  >
                    in list{" "}
                    <span className="font-medium">
                      {lists.find((l) => l.id === card.list_id)?.title ?? "—"}
                    </span>
                  </p>
                </div>
                {/*
                  Header used to host a "Card actions" dropdown
                  (duplicate / archive / delete). Removed per design;
                  SheetContent's built-in top-right close button is the
                  only chrome here. Re-add an action surface elsewhere
                  if those operations need a dedicated trigger.
                */}
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Quick badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "rounded-full px-2.5",
                      PRIORITY_BADGE_CLASS[card.priority],
                    )}
                  >
                    <Flag className="mr-1 h-3 w-3" />
                    {PRIORITY_LABEL[card.priority]}
                  </Badge>
                  {card.due_date && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-border"
                    >
                      <CalendarClock className="mr-1 h-3 w-3" />
                      Due {fmtDateTime(card.due_date)}
                    </Badge>
                  )}
                  {card.completed_at && (
                    <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent">
                      Completed
                    </Badge>
                  )}
                  {card.labels.map((l) => (
                    <span
                      key={l.label_id}
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ background: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Description
                  </h3>
                  {editingDesc ? (
                    <div className="space-y-2">
                      <Textarea
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        className="min-h-[120px]"
                        placeholder="Add a more detailed description…"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveDescription}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingDesc(false);
                            setDescDraft(card.description);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => canEdit && setEditingDesc(true)}
                      className={cn(
                        "w-full text-left rounded-xl bg-muted/40 px-3 py-2.5 text-sm transition-colors",
                        canEdit && "hover:bg-muted",
                      )}
                    >
                      {card.description ? (
                        <span className="whitespace-pre-wrap text-foreground/90">
                          {card.description}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {canEdit
                            ? "Add a more detailed description…"
                            : "No description"}
                        </span>
                      )}
                    </button>
                  )}
                </section>

                {/* Checklists */}
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckSquare className="h-4 w-4 text-primary" />
                      Checklists
                    </h3>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={addChecklist}>
                        <Plus className="h-3.5 w-3.5" /> Add checklist
                      </Button>
                    )}
                  </div>
                  {checklistTotal > 0 && (
                    <div className="mb-3 flex items-center gap-2">
                      <Progress
                        value={Math.round((checklistDone / checklistTotal) * 100)}
                      />
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {Math.round((checklistDone / checklistTotal) * 100)}%
                      </span>
                    </div>
                  )}
                  <div className="space-y-4">
                    {data!.checklists.map((cl) => (
                      <ChecklistBlock
                        key={cl.id}
                        checklist={cl}
                        canEdit={canEdit}
                        onToggle={(it) => toggleChecklistItem(cl.id, it)}
                        onAdd={(text) => addChecklistItem(cl.id, text)}
                        onDeleteItem={(id) => deleteChecklistItem(cl.id, id)}
                        onDelete={() => deleteChecklist(cl.id)}
                      />
                    ))}
                  </div>
                </section>

                {/* Attachments */}
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Paperclip className="h-4 w-4 text-primary" />
                      Attachments ({data!.attachments.length})
                    </h3>
                    {canEdit && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onUploadClick}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                          Upload
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={attachLink}
                        >
                          <Link2 className="h-3.5 w-3.5" /> Link
                        </Button>
                      </div>
                    )}
                  </div>
                  {data!.attachments.length === 0 ? (
                    <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      No attachments yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {data!.attachments.map((a) => (
                        <li
                          key={a.id}
                          className="group flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Paperclip className="h-4 w-4" />
                          </span>
                          <a
                            href={a.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 min-w-0 text-sm font-medium text-foreground hover:underline"
                          >
                            <span className="block truncate">{a.file_name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {fmtDateTime(a.createdAt)} ·{" "}
                              {a.uploaded_by.name}
                            </span>
                          </a>
                          {(canEdit || a.uploaded_by.id === session?.user?.id) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteAttachment(a.id)}
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Delete attachment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Comments */}
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Activity & comments
                  </h3>

                  {canEdit && (
                    <div className="mb-3 rounded-xl border border-border bg-card p-2">
                      <Textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Write a comment…"
                        className="min-h-[60px] border-0 bg-transparent focus-visible:ring-0"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={submitComment}
                          disabled={posting || !commentDraft.trim()}
                        >
                          {posting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Post
                        </Button>
                      </div>
                    </div>
                  )}

                  {data!.comments.length === 0 && activity.length === 0 ? (
                    <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      No activity yet — be the first to comment.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {[...data!.comments]
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime(),
                        )
                        .map((c) => (
                          <li key={c.id} className="flex gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
                              {c.user_name
                                .split(" ")
                                .map((p) => p[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {c.user_name}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {fmtDateTime(c.createdAt)}
                                </span>
                                {c.user_id === session?.user?.id && (
                                  <button
                                    onClick={() => deleteComment(c.id)}
                                    className="ml-auto text-[11px] text-destructive hover:underline"
                                  >
                                    delete
                                  </button>
                                )}
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground">
                                {c.body}
                              </p>
                            </div>
                          </li>
                        ))}

                      {activity.length > 0 && (
                        <li className="pt-2 border-t border-border">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <ActivityIcon className="h-3.5 w-3.5" />
                            History
                          </p>
                          <ul className="space-y-1.5">
                            {activity.slice(0, 30).map((a) => (
                              <li
                                key={a.id}
                                className="flex items-start gap-2 text-xs text-muted-foreground"
                              >
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                                <span className="flex-1">
                                  <span className="text-foreground">
                                    {a.description}
                                  </span>{" "}
                                  · {fmtDateTime(a.createdAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      )}
                    </ul>
                  )}
                </section>
              </div>

              {/* Side column */}
              <div className="space-y-3 lg:col-span-1">
                <SidePanelHeader>Add to card</SidePanelHeader>

                {/* Members */}
                <PopoverPicker
                  label="Members"
                  icon={Users}
                  count={card.members.length}
                  disabled={!canEdit}
                >
                  {boardMembers.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      No members yet.
                    </p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto">
                      {boardMembers.map((m) => {
                        const checked = card.members.some(
                          (x) => x.user_id === m.user_id,
                        );
                        return (
                          <li key={m.id}>
                            <button
                              onClick={() => toggleMember(m)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                            >
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-semibold text-white">
                                {m.user_name
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                              <span className="flex-1 text-left truncate">
                                {m.user_name}
                              </span>
                              {checked && (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </PopoverPicker>

                {/* Labels */}
                <PopoverPicker
                  label="Labels"
                  icon={Tag}
                  count={card.labels.length}
                  disabled={!canEdit}
                >
                  {boardLabels.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      No labels on this board yet. Create them from the
                      board&apos;s Labels view.
                    </p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto space-y-1">
                      {boardLabels.map((lbl) => {
                        const active = card.labels.some(
                          (x) => x.label_id === lbl.id,
                        );
                        return (
                          <li key={lbl.id}>
                            <button
                              onClick={() => toggleLabel(lbl)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:opacity-90 text-white",
                                active && "ring-2 ring-offset-2 ring-offset-background ring-primary",
                              )}
                              style={{ background: lbl.color }}
                            >
                              <span className="flex-1 text-left truncate">
                                {lbl.name}
                              </span>
                              {active && (
                                <CheckSquare className="h-4 w-4" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </PopoverPicker>

                {/* Due date */}
                <DatePopover
                  card={card}
                  disabled={!canEdit}
                  onSave={(start, due) =>
                    patchCard(
                      { start_date: start, due_date: due },
                      { silent: false },
                    )
                  }
                  onMarkComplete={(done) =>
                    patchCard(
                      { completed_at: done ? new Date().toISOString() : null },
                      { silent: true },
                    )
                  }
                />

                {/* Priority */}
                <PriorityPopover
                  current={card.priority}
                  disabled={!canEdit}
                  onChange={(next) => patchCard({ priority: next }, { silent: true })}
                />

                {/* Move list */}
                <ListMovePopover
                  current={card.list_id}
                  lists={lists}
                  disabled={!canEdit}
                  onPick={(listId) =>
                    patchCard({ list_id: listId }, { silent: false })
                  }
                />

                {/* Cover */}
                <CoverPopover
                  current={card.cover}
                  disabled={!canEdit}
                  onPick={(cover) => patchCard({ cover }, { silent: true })}
                />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Side-panel sub-components ────────────────────────────────────

function SidePanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function PopoverPicker({
  label,
  icon: Icon,
  count,
  disabled,
  children,
}: {
  label: string;
  icon: React.ElementType;
  count?: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-medium transition-colors",
            "hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </span>
          {typeof count === "number" && count > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {count}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DatePopover({
  card,
  disabled,
  onSave,
  onMarkComplete,
}: {
  card: Card;
  disabled: boolean;
  onSave: (start: string | null, due: string | null) => Promise<unknown>;
  onMarkComplete: (done: boolean) => Promise<unknown>;
}) {
  const [start, setStart] = React.useState(toDateInput(card.start_date));
  const [due, setDue] = React.useState(toDateInput(card.due_date));

  React.useEffect(() => {
    setStart(toDateInput(card.start_date));
    setDue(toDateInput(card.due_date));
  }, [card.start_date, card.due_date]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Dates
          </span>
          {(card.start_date || card.due_date) && (
            <Badge variant="secondary" className="rounded-full">
              set
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-3 space-y-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Start date
          </label>
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Due date
          </label>
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStart("");
              setDue("");
              void onSave(null, null);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => {
              void onSave(start || null, due || null);
            }}
          >
            Save
          </Button>
        </div>
        <div className="border-t border-border pt-2">
          <Button
            size="sm"
            variant={card.completed_at ? "secondary" : "outline"}
            className="w-full"
            onClick={() => onMarkComplete(!card.completed_at)}
          >
            {card.completed_at ? "Mark as incomplete" : "Mark as complete"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityPopover({
  current,
  disabled,
  onChange,
}: {
  current: CardPriority;
  disabled: boolean;
  onChange: (p: CardPriority) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Priority
          </span>
          <Badge
            className={cn("rounded-full", PRIORITY_BADGE_CLASS[current])}
          >
            {PRIORITY_LABEL[current]}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 p-1">
        {PRIORITY_OPTIONS.map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => onChange(p)}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                p === "low" && "bg-emerald-500",
                p === "medium" && "bg-sky-500",
                p === "high" && "bg-amber-500",
                p === "urgent" && "bg-rose-500",
              )}
            />
            <span className="flex-1">{PRIORITY_LABEL[p]}</span>
            {p === current && <CheckSquare className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListMovePopover({
  current,
  lists,
  disabled,
  onPick,
}: {
  current: string;
  lists: Array<{ id: string; title: string }>;
  disabled: boolean;
  onPick: (listId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-primary/40" />
            Move to list
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1 max-h-72 overflow-y-auto">
        {lists.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => l.id !== current && onPick(l.id)}
            className={cn(l.id === current && "opacity-50")}
          >
            {l.title}
            {l.id === current && (
              <CheckSquare className="ml-auto h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CoverPopover({
  current,
  disabled,
  onPick,
}: {
  current: string;
  disabled: boolean;
  onPick: (cover: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Cover
          </span>
          {current && (
            <span
              className="inline-block h-4 w-4 rounded"
              style={{ background: current }}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2">
        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => onPick("")}
            className="flex h-9 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-muted"
            title="Remove cover"
          >
            none
          </button>
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              className={cn(
                "h-9 rounded-md transition-transform hover:scale-105",
                current === c &&
                  "ring-2 ring-offset-2 ring-offset-background ring-foreground",
              )}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Inline checklist component ───────────────────────────────────

function ChecklistBlock({
  checklist,
  canEdit,
  onToggle,
  onAdd,
  onDeleteItem,
  onDelete,
}: {
  checklist: Checklist;
  canEdit: boolean;
  onToggle: (item: ChecklistItem) => void;
  onAdd: (text: string) => void;
  onDeleteItem: (id: string) => void;
  onDelete: () => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.is_completed).length;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="flex-1 text-sm font-semibold text-foreground">
          {checklist.title}
        </h4>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 p-0"
            aria-label="Delete checklist"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {total > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <Progress value={Math.round((done / total) * 100)} />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </div>
      )}
      <ul className="space-y-1">
        {checklist.items.map((it) => (
          <li
            key={it.id}
            className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60"
          >
            <Checkbox
              checked={it.is_completed}
              onCheckedChange={() => onToggle(it)}
              disabled={!canEdit}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                it.is_completed && "line-through text-muted-foreground",
              )}
            >
              {it.text}
            </span>
            {canEdit && (
              <button
                onClick={() => onDeleteItem(it.id)}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit &&
        (adding ? (
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add an item…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  onAdd(draft.trim());
                  setDraft("");
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (draft.trim()) {
                  onAdd(draft.trim());
                  setDraft("");
                }
              }}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        ))}
    </div>
  );
}
