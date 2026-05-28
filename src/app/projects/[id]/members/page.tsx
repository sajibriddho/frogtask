"use client";

/**
 * Per-board Members page — invite a workspace user, change their role,
 * or remove. The owner cannot be demoted away if they are the last one.
 */

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, X, Users, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { parseJsonSafe } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";

import { ProjectsTabs } from "../../_components/ProjectsTabs";
import {
  ROLE_LABEL,
  type BoardMember,
  type BoardRole,
} from "@/types/project";

interface AppUserLite {
  _id: string;
  name: string;
  email: string;
}

const ROLES: BoardRole[] = ["owner", "admin", "member", "viewer"];

export default function BoardMembersPage() {
  const params = useParams<{ id: string }>();
  const boardId = params?.id ?? "";
  const { has } = usePermissions();
  const canInvite = has("projects.members.invite");
  const canRemove = has("projects.members.remove");

  const [members, setMembers] = React.useState<BoardMember[]>([]);
  const [users, setUsers] = React.useState<AppUserLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<BoardRole>("member");
  const [working, setWorking] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [memRes, usersRes] = await Promise.all([
        fetch(`/api/projects/boards/${boardId}/members`, { cache: "no-store" }),
        fetch("/api/users/lookup", { cache: "no-store" }),
      ]);
      const memJson = await parseJsonSafe<{
        success: boolean;
        data?: BoardMember[];
        error?: string;
      }>(memRes);
      const usersJson = await parseJsonSafe<{
        success: boolean;
        data?: AppUserLite[];
      }>(usersRes);
      if (!memJson.success) {
        toast.error(memJson.error || "Failed to load members");
      } else {
        setMembers(memJson.data ?? []);
      }
      setUsers(usersJson.success ? (usersJson.data ?? []) : []);
    } finally {
      setLoading(false);
    }
  }, [boardId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const inviteCandidates = React.useMemo(() => {
    const set = new Set(members.map((m) => m.user_id));
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => !set.has(u._id))
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
  }, [users, members, search]);

  const invite = async (u: AppUserLite) => {
    setWorking(u._id);
    try {
      const res = await fetch(`/api/projects/boards/${boardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u._id, role: inviteRole }),
      });
      const json = await parseJsonSafe<{
        success: boolean;
        error?: string;
      }>(res);
      if (!json.success) {
        toast.error(json.error || "Failed to invite");
        return;
      }
      toast.success(`${u.name} added as ${ROLE_LABEL[inviteRole]}`);
      await load();
    } finally {
      setWorking(null);
    }
  };

  const updateRole = async (m: BoardMember, role: BoardRole) => {
    if (role === m.role) return;
    setWorking(m.id);
    try {
      const res = await fetch(
        `/api/projects/boards/${boardId}/members/${m.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to update role");
        return;
      }
      toast.success("Role updated");
      await load();
    } finally {
      setWorking(null);
    }
  };

  const removeMember = async (m: BoardMember) => {
    if (
      !window.confirm(`Remove ${m.user_name} from the board?`)
    )
      return;
    setWorking(m.id);
    try {
      const res = await fetch(
        `/api/projects/boards/${boardId}/members/${m.id}`,
        { method: "DELETE" },
      );
      const json = await parseJsonSafe<{ success: boolean; error?: string }>(
        res,
      );
      if (!json.success) {
        toast.error(json.error || "Failed to remove");
        return;
      }
      toast.success(`${m.user_name} removed`);
      await load();
    } finally {
      setWorking(null);
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
        <h1 className="text-lg font-semibold">Board members</h1>
        {canInvite && (
          <Button
            className="ml-auto"
            onClick={() => setInviteOpen((v) => !v)}
          >
            <UserPlus className="h-4 w-4" />
            {inviteOpen ? "Close" : "Invite"}
          </Button>
        )}
      </div>

      {inviteOpen && canInvite && (
        <Card className="mb-4 border-border">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a workspace user…"
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as BoardRole)}
                className="rounded-xl bg-muted px-3 py-2 text-sm font-medium"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            {inviteCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No matching users.
              </p>
            ) : (
              <ul className="divide-y divide-border max-h-64 overflow-y-auto rounded-xl border border-border">
                {inviteCandidates.slice(0, 50).map((u) => (
                  <li
                    key={u._id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
                      {u.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => invite(u)}
                      disabled={working === u._id}
                    >
                      {working === u._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="inline h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">No explicit members</p>
              <p className="text-xs text-muted-foreground">
                Anyone in the workspace may still see this board if it&apos;s
                set to Team or Public.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
                    {m.user_name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {m.user_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.user_email}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Badge
                        className={cn(
                          "cursor-pointer rounded-full",
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
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ROLES.map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={() => updateRole(m, r)}
                          className={cn(r === m.role && "opacity-50")}
                        >
                          {ROLE_LABEL[r]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {canRemove && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeMember(m)}
                      disabled={working === m.id}
                      aria-label="Remove member"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      {working === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
