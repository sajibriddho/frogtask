"use client";

/**
 * Labels index — every label across every accessible board, grouped per
 * board. Each card links into the per-board label manager. Useful for
 * users who manage many boards and want a quick overview.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Tag, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { parseJsonSafe } from "@/lib/api";

import { ProjectsTabs } from "../_components/ProjectsTabs";
import { BoardCover } from "../_components/BoardCover";
import type { Board, Label } from "@/types/project";

interface BoardWithLabels {
  board: Board;
  labels: Label[];
}

export default function LabelsIndexPage() {
  const [data, setData] = React.useState<BoardWithLabels[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/projects/boards", {
          cache: "no-store",
        });
        const json = await parseJsonSafe<{
          success: boolean;
          data?: Board[];
        }>(res);
        const boards = json.success ? (json.data ?? []) : [];
        const all = await Promise.all(
          boards.map(async (b) => {
            try {
              const r = await fetch(
                `/api/projects/boards/${b.id}/labels`,
                { cache: "no-store" },
              );
              const j = await parseJsonSafe<{
                success: boolean;
                data?: Label[];
              }>(r);
              return { board: b, labels: j.success ? (j.data ?? []) : [] };
            } catch {
              return { board: b, labels: [] };
            }
          }),
        );
        if (!cancelled) setData(all);
      } catch (err) {
        toast.error("Failed to load labels");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data
      .map((d) => ({
        ...d,
        labels: d.labels.filter((l) => l.name.toLowerCase().includes(q)),
      }))
      .filter(
        (d) => d.board.title.toLowerCase().includes(q) || d.labels.length > 0,
      );
  }, [data, search]);

  return (
    <div>
      <ProjectsTabs />

      <Card className="mb-4 border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex items-center gap-4 px-5 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Tag className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Labels
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reusable colour-coded tags scoped to each board.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 border-border">
        <CardContent className="p-3 sm:p-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by board or label…"
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No labels match your search.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ board, labels }) => (
            <Card key={board.id} className="border-border overflow-hidden">
              <CardContent className="p-0">
                <Link
                  href={`/projects/${board.id}/labels`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors"
                >
                  <BoardCover
                    background={board.background}
                    className="h-9 w-12"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {board.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {labels.length} label{labels.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                {labels.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">
                    No labels yet on this board.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 px-4 py-3">
                    {labels.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{ background: l.color }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
