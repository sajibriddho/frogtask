"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPageNumbers } from "@/hooks/usePagination";

interface MasterPaginationProps {
  start: number;
  end: number;
  totalItems: number;
  currentPage: number;
  totalPages: number;
  empty: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
}

export function MasterPagination({
  start,
  end,
  totalItems,
  currentPage,
  totalPages,
  empty,
  onPrev,
  onNext,
  onPageChange,
}: MasterPaginationProps) {
  if (empty) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start + 1}</span>{" "}
        to <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span> entries
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pageNumbers.map((p) => (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(p)}
            className={cn(
              "h-8 w-8 p-0 text-xs",
              p === currentPage && "pointer-events-none",
            )}
          >
            {p}
          </Button>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
