"use client";

import * as React from "react";
import { Pencil, Eye, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSort } from "@/hooks/useSort";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  /** Set to false to opt this column out of sorting. Defaults to true. */
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  onEdit?: (item: T) => void;
  onView?: (item: T) => void;
  onDelete?: (item: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  onEdit,
  onView,
  onDelete,
  className,
}: DataTableProps<T>) {
  const hasActions = onEdit ?? onView ?? onDelete;
  const colCount = columns.length + (hasActions ? 1 : 0);
  const { sorted, sortKey, direction, requestSort } = useSort<T>(data);

  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border overflow-hidden shadow-sm",
        className
      )}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
              {columns.map((column) => {
                const sortable = column.sortable !== false;
                if (!sortable) {
                  return (
                    <TableHead
                      key={column.key}
                      className={cn(
                        "text-xs font-semibold text-muted-foreground uppercase tracking-wider py-4 px-6",
                        column.className,
                      )}
                      style={{ width: column.width }}
                    >
                      {column.header}
                    </TableHead>
                  );
                }
                return (
                  <SortableTableHead
                    key={column.key}
                    sortKey={column.key}
                    current={sortKey}
                    direction={direction}
                    onSort={requestSort}
                    className={cn("py-4 px-6", column.className)}
                    style={{ width: column.width }}
                  >
                    {column.header}
                  </SortableTableHead>
                );
              })}
              {hasActions && (
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-4 px-6 text-right w-[120px]">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={colCount}
                  className="h-32 text-center text-muted-foreground bg-card"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((item, index) => (
                <TableRow
                  key={index}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "border-b border-border last:border-0 bg-card transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "py-4 px-6 text-sm text-foreground",
                        column.className
                      )}
                    >
                      {column.render
                        ? column.render(item)
                        : item[column.key]?.toString() ?? "-"}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell
                      className="py-4 px-6 text-right bg-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => onView(item)}
                            aria-label="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => onEdit(item)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => onDelete(item)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
