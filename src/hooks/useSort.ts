"use client";

/**
 * useSort — generic ascending/descending sort hook for table data.
 *
 * Cycles a column through three states on click: asc → desc → unsorted.
 * Returns the sorted array plus helpers a `<SortableTableHead>` reads to
 * render its arrow indicator.
 *
 * Usage:
 *   const { sorted, sortKey, direction, requestSort } = useSort(items, "name");
 *   <SortableTableHead sortKey="name" current={sortKey} direction={direction}
 *                      onSort={requestSort}>Name</SortableTableHead>
 */

import * as React from "react";

export type SortDirection = "asc" | "desc";

interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

export interface UseSortReturn<T, K extends string> {
  sorted: T[];
  sortKey: K | null;
  direction: SortDirection;
  /** Click handler — toggles a column through asc → desc → unsorted. */
  requestSort: (key: K) => void;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  // Push null / undefined / "" to the bottom in either direction.
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  // Try ISO-date strings before falling back to lexical compare.
  if (typeof a === "string" && typeof b === "string") {
    const da = Date.parse(a);
    const db = Date.parse(b);
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }
  return String(a).localeCompare(String(b));
}

export function useSort<T extends object, K extends string = string>(
  items: T[],
  initialKey: K | null = null,
  initialDirection: SortDirection = "asc",
): UseSortReturn<T, K> {
  const [state, setState] = React.useState<SortState<K>>({
    key: initialKey,
    direction: initialDirection,
  });

  const requestSort = React.useCallback((key: K) => {
    setState((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      // Third click clears the sort.
      return { key: null, direction: "asc" };
    });
  }, []);

  const sorted = React.useMemo(() => {
    if (!state.key) return items;
    const k = state.key;
    const factor = state.direction === "asc" ? 1 : -1;
    const pluck = (row: T): unknown => (row as Record<string, unknown>)[k];
    // Stable copy — never mutate the caller's array.
    return [...items].sort((a, b) => factor * compareValues(pluck(a), pluck(b)));
  }, [items, state.key, state.direction]);

  return {
    sorted,
    sortKey: state.key,
    direction: state.direction,
    requestSort,
  };
}
