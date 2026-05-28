"use client";

/**
 * Client-side permission hook.
 *
 * Loads `/api/role-permissions/:roleId` once per session, caches it at
 * module level so every consumer (sidebar, page-level button gates,
 * conditional UI) shares one network round-trip and one source of truth.
 *
 * Returns:
 *   loading         – true until the first fetch completes
 *   permissionIds   – Set<string>; never null after `loading` flips
 *   has(id)         – exact-match-or-ancestor check, mirrors the server's
 *                     `requirePermission` so the UI cannot show a button
 *                     the API would reject
 *   hasMenu(id)     – "any descendant grants the menu" check, used to
 *                     decide whether a sidebar entry should be visible
 *                     even if the user only holds an action-level child
 *                     permission
 *   refresh()       – re-fetch (e.g. after the admin updates a role)
 */

import * as React from "react";
import { useSession } from "next-auth/react";

import { ancestorsOf } from "@/lib/menu-permissions";

let cache: { roleId: string; ids: Set<string> } | null = null;
let inflight: Promise<Set<string>> | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

async function fetchPermissions(roleId: string): Promise<Set<string>> {
  if (cache && cache.roleId === roleId) return cache.ids;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`/api/role-permissions/${roleId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      const arr: string[] =
        json?.success && Array.isArray(json?.data?.permission_ids)
          ? json.data.permission_ids
          : [];
      const ids = new Set(arr);
      cache = { roleId, ids };
      listeners.forEach((cb) => cb(ids));
      return ids;
    } catch {
      const ids = new Set<string>();
      cache = { roleId, ids };
      listeners.forEach((cb) => cb(ids));
      return ids;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function refreshPermissions(): void {
  cache = null;
  inflight = null;
}

export interface UsePermissions {
  loading: boolean;
  permissionIds: Set<string>;
  has(id: string): boolean;
  hasMenu(menuId: string): boolean;
  refresh(): void;
}

export function usePermissions(): UsePermissions {
  const { data: session } = useSession();
  const roleId = session?.user?.role_id ?? "";

  const [ids, setIds] = React.useState<Set<string> | null>(
    cache && cache.roleId === roleId ? cache.ids : null,
  );

  React.useEffect(() => {
    if (!roleId) {
      setIds(new Set());
      return;
    }

    let cancelled = false;
    const onUpdate = (next: Set<string>) => {
      if (!cancelled) setIds(next);
    };
    listeners.add(onUpdate);

    void fetchPermissions(roleId).then((next) => {
      if (!cancelled) setIds(next);
    });

    return () => {
      cancelled = true;
      listeners.delete(onUpdate);
    };
  }, [roleId]);

  const safeIds = React.useMemo(
    () => ids ?? new Set<string>(),
    [ids],
  );

  const has = React.useCallback(
    (id: string): boolean => {
      if (safeIds.has(id)) return true;
      for (const ancestor of ancestorsOf(id)) {
        if (safeIds.has(ancestor)) return true;
      }
      return false;
    },
    [safeIds],
  );

  const hasMenu = React.useCallback(
    (menuId: string): boolean => {
      if (safeIds.has(menuId)) return true;
      const prefix = menuId + ".";
      for (const id of safeIds) {
        if (id.startsWith(prefix)) return true;
      }
      return false;
    },
    [safeIds],
  );

  const refresh = React.useCallback(() => {
    refreshPermissions();
    if (roleId) void fetchPermissions(roleId).then((next) => setIds(next));
  }, [roleId]);

  return {
    loading: ids === null,
    permissionIds: safeIds,
    has,
    hasMenu,
    refresh,
  };
}
