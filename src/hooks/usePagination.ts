"use client";

/**
 * usePagination – shared pagination state and helpers for master data tables.
 * Use with filtered list; hook handles page slice and clamping.
 * @see MasterPagination for the UI bar.
 */

import * as React from "react";

/** Default page size for master data tables. */
export const DEFAULT_ITEMS_PER_PAGE = 10;

/**
 * Returns the list of page numbers to show (max 5), centered around current when possible.
 */
export function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, 5];
  if (currentPage >= totalPages - 2) return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
  return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
}

export interface UsePaginationOptions<T> {
  /** Full list of items (e.g. after filtering). */
  items: T[];
  /** Number of items per page. Defaults to DEFAULT_ITEMS_PER_PAGE. */
  itemsPerPage?: number;
}

export interface UsePaginationReturn<T> {
  /** Current 1-based page. */
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  /** Total number of pages. */
  totalPages: number;
  /** Items for the current page. */
  pageData: T[];
  /** 0-based start index for "Showing X to Y" (X = start + 1). */
  start: number;
  /** End index for "Showing X to Y" (Y = end). */
  end: number;
  /** Go to previous page. */
  goPrev: () => void;
  /** Go to next page. */
  goNext: () => void;
  /** Page numbers to display in the pagination bar. */
  getPageNumbers: () => number[];
}

/**
 * Pagination state and helpers for master data tables.
 * Pass your filtered list; hook handles slicing and page clamping.
 */
export function usePagination<T>({
  items,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  const pageData = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  const start = (currentPage - 1) * itemsPerPage;
  const end = Math.min(currentPage * itemsPerPage, items.length);

  React.useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const goPrev = React.useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const getPageNumbersMemo = React.useCallback(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    pageData,
    start,
    end,
    goPrev,
    goNext,
    getPageNumbers: getPageNumbersMemo,
  };
}
