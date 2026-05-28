"use client";

/**
 * ManageTagsModal — add / edit / delete the caller's task tags.
 *
 * Self-contained: fetches /api/task-tags on open, calls back to the
 * parent (`onChanged`) after any mutation so the All Tasks page can
 * refresh its tag list and re-render the grouped view.
 */

import * as React from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { TASK_TAG_COLORS, type TaskTag } from "@/types/task-tag";

interface ManageTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any successful create / update / delete. */
  onChanged: () => void;
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TASK_TAG_COLORS.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-transform",
              active
                ? "border-foreground scale-110 ring-2 ring-foreground/20"
                : "border-transparent hover:scale-110",
            )}
            style={{ backgroundColor: c }}
            aria-label={`Pick colour ${c}`}
            aria-pressed={active}
          />
        );
      })}
    </div>
  );
}

export function ManageTagsModal({
  open,
  onOpenChange,
  onChanged,
}: ManageTagsModalProps) {
  const [tags, setTags] = React.useState<TaskTag[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Create form state
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState(TASK_TAG_COLORS[0]);
  const [creating, setCreating] = React.useState(false);

  // Inline edit state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState(TASK_TAG_COLORS[0]);
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Delete confirmation state
  const [deleteTag, setDeleteTag] = React.useState<TaskTag | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fetchTags = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/task-tags", { cache: "no-store" });
      const data = await parseJsonSafe<{
        success: boolean;
        data?: TaskTag[];
        error?: string;
      }>(res);
      if (data.success) {
        setTags(data.data ?? []);
      } else {
        toast.error(data.error || "Failed to load tags");
      }
    } catch (err) {
      console.error("fetch tags", err);
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setNewName("");
    setNewColor(TASK_TAG_COLORS[0]);
    fetchTags();
  }, [open, fetchTags]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a tag name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/task-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      const data = await parseJsonSafe<{
        success: boolean;
        data?: TaskTag;
        error?: string;
      }>(res);
      if (!data.success || !data.data) {
        toast.error(data.error || "Failed to create tag");
        return;
      }
      toast.success("Tag created");
      setNewName("");
      setNewColor(TASK_TAG_COLORS[0]);
      await fetchTags();
      onChanged();
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t: TaskTag) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Tag name is required");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/task-tags/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: editColor }),
      });
      const data = await parseJsonSafe<{
        success: boolean;
        data?: TaskTag;
        error?: string;
      }>(res);
      if (!data.success || !data.data) {
        toast.error(data.error || "Failed to update tag");
        return;
      }
      toast.success("Tag updated");
      setEditingId(null);
      await fetchTags();
      onChanged();
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTag) return;
    const id = deleteTag.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/task-tags/${id}`, { method: "DELETE" });
      const data = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!data.success) {
        toast.error(data.error || "Failed to delete tag");
        return;
      }
      toast.success("Tag deleted");
      setDeleteTag(null);
      await fetchTags();
      onChanged();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Tag className="h-4 w-4" />
              </span>
              Manage tags
            </DialogTitle>
            <DialogDescription className="text-xs">
              Group your tasks by project, area, or anything else. Tags are
              private to you.
            </DialogDescription>
          </DialogHeader>

          {/* Create form */}
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  New tag
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Frogtask, Personal, Marketing"
                  className="mt-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  maxLength={64}
                  disabled={creating}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="shrink-0"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="mt-3">
              <ColorSwatches value={newColor} onChange={setNewColor} />
            </div>
          </div>

          {/* Tag list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : tags.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
                  <Tag className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  No tags yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first tag above.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {tags.map((t) => {
                  const isEditing = editingId === t.id;
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        "rounded-xl border border-border bg-card px-3 py-2.5 transition-colors",
                        isEditing && "bg-muted/40",
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: editColor }}
                            />
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={64}
                              disabled={savingEdit}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveEdit();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="table-action-btn"
                              title="Save"
                              onClick={saveEdit}
                              disabled={savingEdit}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="table-action-btn"
                              title="Cancel"
                              onClick={cancelEdit}
                              disabled={savingEdit}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <ColorSwatches
                            value={editColor}
                            onChange={setEditColor}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            <Tag className="h-3 w-3" />
                            {t.name}
                          </span>
                          <span className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              className="table-action-btn"
                              title="Edit"
                              onClick={() => startEdit(t)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="table-action-btn-delete"
                              title="Delete"
                              onClick={() => setDeleteTag(t)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border bg-card px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTag}
        onOpenChange={(o) => {
          if (!o) setDeleteTag(null);
        }}
        title="Delete tag"
        description={
          deleteTag
            ? `"${deleteTag.name}" will be removed and detached from every task that uses it. The tasks themselves are not deleted.`
            : ""
        }
        actionLabel={deleting ? "Deleting…" : "Delete"}
        variant="destructive"
        loading={deleting}
        onAction={confirmDelete}
      />
    </>
  );
}
