"use client";

/**
 * Per-board labels manager.
 *
 * Lists every label for the board and lets members create / rename /
 * recolour / delete. Renaming a label patches every card that uses it
 * (server-side — see /api/projects/labels/[id]/route.ts).
 */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Tag, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";

import { ProjectsTabs } from "../../_components/ProjectsTabs";
import { LABEL_COLORS, type Label } from "@/types/project";

export default function BoardLabelsPage() {
  const params = useParams<{ id: string }>();
  const boardId = params?.id ?? "";
  const [labels, setLabels] = React.useState<Label[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [draftName, setDraftName] = React.useState("");
  const [draftColor, setDraftColor] = React.useState(LABEL_COLORS[0]);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/boards/${boardId}/labels`, {
        cache: "no-store",
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Label[];
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to load labels");
        return;
      }
      setLabels(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [boardId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!draftName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/boards/${boardId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName.trim(), color: draftColor }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Label;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to create label");
        return;
      }
      setLabels((arr) => [...arr, json.data as Label]);
      setDraftName("");
    } finally {
      setCreating(false);
    }
  };

  const update = async (id: string, patch: Partial<Label>) => {
    try {
      const res = await fetch(`/api/projects/labels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Label;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to update");
        return;
      }
      setLabels((arr) =>
        arr.map((l) => (l.id === id ? (json.data as Label) : l)),
      );
    } catch {
      toast.error("Failed to update");
    }
  };

  const remove = async (id: string) => {
    if (
      !window.confirm(
        "Delete this label? It will be removed from every card that uses it.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/projects/labels/${id}`, {
        method: "DELETE",
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to delete");
        return;
      }
      setLabels((arr) => arr.filter((l) => l.id !== id));
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div>
      <ProjectsTabs />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/projects/${boardId}`} aria-label="Back to board">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Board labels</h1>
      </div>

      <Card className="mb-4 border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Label name…"
              className="flex-1 min-w-[200px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
            />
            <Button onClick={create} disabled={creating || !draftName.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add label
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDraftColor(c)}
                className={cn(
                  "h-8 w-8 rounded-full transition-transform hover:scale-105",
                  draftColor === c &&
                    "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="inline h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : labels.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <Tag className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">No labels yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Labels help categorise cards. Create one with the form above.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {labels.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <Input
                    defaultValue={l.name}
                    className="flex-1 min-w-[180px]"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== l.name) void update(l.id, { name: v });
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    {LABEL_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => update(l.id, { color: c })}
                        className={cn(
                          "h-6 w-6 rounded-full transition-transform hover:scale-110",
                          l.color === c &&
                            "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(l.id)}
                    aria-label="Delete label"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
