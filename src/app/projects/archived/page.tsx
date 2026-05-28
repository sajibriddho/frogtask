"use client";

/**
 * Archived items — boards, lists, and cards that have been archived.
 * Restore puts them back; "Open board" sends you to the kanban with the
 * card visible after restore.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, RotateCcw, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parseJsonSafe } from "@/lib/api";

import { ProjectsTabs } from "../_components/ProjectsTabs";
import { BoardCover } from "../_components/BoardCover";

interface ArchivedPayload {
  archived_boards: Array<{
    id: string;
    title: string;
    background: string;
  }>;
  archived_lists: Array<{
    id: string;
    board_id: string;
    title: string;
    board_title: string;
    updatedAt?: string;
  }>;
  archived_cards: Array<{
    id: string;
    board_id: string;
    title: string;
    board_title: string;
    updatedAt?: string;
  }>;
}

export default function ArchivedPage() {
  const [data, setData] = React.useState<ArchivedPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [restoring, setRestoring] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/archived", { cache: "no-store" });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: ArchivedPayload;
        error?: string;
      }>(res);
      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to load archived items");
        return;
      }
      setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const restore = async (type: "board" | "list" | "card", id: string) => {
    setRestoring(id);
    try {
      const res = await fetch("/api/projects/archived/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to restore");
        return;
      }
      toast.success("Restored");
      await load();
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div>
      <ProjectsTabs />

      <Card className="mb-4 border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex items-center gap-4 px-5 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Archive className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Archived items
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Restore or permanently remove archived boards, lists and cards.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading || !data ? (
        <div className="space-y-3">
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
        </div>
      ) : (
        <Tabs defaultValue="cards">
          <TabsList className="mb-4">
            <TabsTrigger value="cards">
              Cards{" "}
              <Badge variant="secondary" className="ml-2 rounded-full">
                {data.archived_cards.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="lists">
              Lists{" "}
              <Badge variant="secondary" className="ml-2 rounded-full">
                {data.archived_lists.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="boards">
              Boards{" "}
              <Badge variant="secondary" className="ml-2 rounded-full">
                {data.archived_boards.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            <ArchivedCards
              items={data.archived_cards}
              onRestore={(id) => restore("card", id)}
              restoringId={restoring}
            />
          </TabsContent>
          <TabsContent value="lists">
            <ArchivedLists
              items={data.archived_lists}
              onRestore={(id) => restore("list", id)}
              restoringId={restoring}
            />
          </TabsContent>
          <TabsContent value="boards">
            <ArchivedBoards
              items={data.archived_boards}
              onRestore={(id) => restore("board", id)}
              restoringId={restoring}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ArchivedCards({
  items,
  onRestore,
  restoringId,
}: {
  items: ArchivedPayload["archived_cards"];
  onRestore: (id: string) => void;
  restoringId: string | null;
}) {
  if (items.length === 0) return <Empty label="No archived cards." />;
  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {c.board_title}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRestore(c.id)}
                disabled={restoringId === c.id}
              >
                {restoringId === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ArchivedLists({
  items,
  onRestore,
  restoringId,
}: {
  items: ArchivedPayload["archived_lists"];
  onRestore: (id: string) => void;
  restoringId: string | null;
}) {
  if (items.length === 0) return <Empty label="No archived lists." />;
  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {items.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {l.board_title}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRestore(l.id)}
                disabled={restoringId === l.id}
              >
                {restoringId === l.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ArchivedBoards({
  items,
  onRestore,
  restoringId,
}: {
  items: ArchivedPayload["archived_boards"];
  onRestore: (id: string) => void;
  restoringId: string | null;
}) {
  if (items.length === 0) return <Empty label="No archived boards." />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <BoardCover background={b.background} className="h-12 w-16" />
          <div className="flex-1 min-w-0">
            <Link
              href={`/projects/${b.id}`}
              className="text-sm font-semibold truncate hover:underline"
            >
              {b.title}
            </Link>
            <p className="text-[11px] text-muted-foreground">Archived</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRestore(b.id)}
            disabled={restoringId === b.id}
          >
            {restoringId === b.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Restore
          </Button>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Card className="border-dashed border-border">
      <CardContent className="py-12 text-center">
        <Archive className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
