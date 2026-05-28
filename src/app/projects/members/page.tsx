"use client";

/**
 * Members directory — aggregated view of every board the caller can see
 * along with its team. Use the per-board page (/projects/[id]/members)
 * to actually invite or change roles.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Users, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { parseJsonSafe } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ProjectsTabs } from "../_components/ProjectsTabs";
import { BoardCover } from "../_components/BoardCover";
import { ROLE_LABEL, type Board, type BoardMember } from "@/types/project";

interface BoardWithMembers {
  board: Board;
  members: BoardMember[];
}

export default function MembersIndexPage() {
  const [data, setData] = React.useState<BoardWithMembers[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects/boards", { cache: "no-store" });
      const json = await parseJsonSafe<{
        success: boolean;
        data?: Board[];
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to load boards");
        return;
      }
      const boards = json.data ?? [];
      const all = await Promise.all(
        boards.map(async (b) => {
          try {
            const memRes = await fetch(
              `/api/projects/boards/${b.id}/members`,
              { cache: "no-store" },
            );
            const memJson = await parseJsonSafe<{
              success: boolean;
              data?: BoardMember[];
            }>(memRes);
            return {
              board: b,
              members: memJson.success ? (memJson.data ?? []) : [],
            };
          } catch {
            return { board: b, members: [] };
          }
        }),
      );
      setData(all);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data
      .map((d) => ({
        ...d,
        members: d.members.filter(
          (m) =>
            m.user_name.toLowerCase().includes(q) ||
            m.user_email?.toLowerCase().includes(q),
        ),
      }))
      .filter(
        (d) =>
          d.board.title.toLowerCase().includes(q) || d.members.length > 0,
      );
  }, [data, search]);

  return (
    <div>
      <ProjectsTabs />

      <Card className="mb-4 border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex items-center gap-4 px-5 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Users className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Members &amp; Team
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Members per board, with their role. Open a board to invite,
              promote, or remove someone.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 border-border">
        <CardContent className="p-3 sm:p-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by board, name or email…"
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No matching boards or members.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ board, members }) => (
            <Card key={board.id} className="border-border overflow-hidden">
              <CardContent className="p-0">
                <Link
                  href={`/projects/${board.id}/members`}
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
                      {members.length} member{members.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                {members.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">
                    No explicit members yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
                          {m.user_name
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.user_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {m.user_email}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "rounded-full",
                            m.role === "owner" &&
                              "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-transparent",
                            m.role === "admin" &&
                              "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 border-transparent",
                            m.role === "member" &&
                              "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-transparent",
                            m.role === "viewer" &&
                              "bg-muted text-muted-foreground border-transparent",
                          )}
                        >
                          {ROLE_LABEL[m.role]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
