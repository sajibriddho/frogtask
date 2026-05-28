import * as React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/useSort";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto bg-transparent" style={{ WebkitOverflowScrolling: "touch" }}>
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm min-w-[600px]", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-muted/40 [&_tr]:border-b", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-primary/5 data-[state=selected]:bg-primary/10",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

// ── Sortable header ────────────────────────────────────────────────────

export interface SortableTableHeadProps<K extends string>
  extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "onClick"> {
  /** Stable key passed back to `onSort`. Pair with `useSort`. */
  sortKey: K;
  /** Currently active sort key, or null when nothing is sorted. */
  current: K | null;
  /** Direction of the active sort (only meaningful when `current === sortKey`). */
  direction: SortDirection;
  /** Click handler — typically the `requestSort` callback from `useSort`. */
  onSort: (key: K) => void;
  /** Visible label / column heading. */
  children: React.ReactNode;
  /** Disable sorting on this column (renders as a plain header). */
  disabled?: boolean;
}

/**
 * Header cell that flips between asc / desc / unsorted. Visible up/down
 * arrow communicates the current state. Designed to drop into existing
 * `<TableHeader>` rows without restructuring tables.
 */
function SortableTableHeadInner<K extends string>(
  {
    sortKey,
    current,
    direction,
    onSort,
    children,
    disabled,
    className,
    ...props
  }: SortableTableHeadProps<K>,
  ref: React.Ref<HTMLTableCellElement>,
) {
  const isActive = !disabled && current === sortKey;
  const Icon = !isActive ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      ref={ref}
      aria-sort={ariaSort}
      className={cn(
        "h-10 px-4 text-left align-middle font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {disabled ? (
        <span className="text-xs font-semibold uppercase tracking-wider">
          {children}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          data-active={isActive}
          className="table-sort-btn"
          aria-label={`Sort by ${typeof children === "string" ? children : sortKey}`}
        >
          <span>{children}</span>
          <Icon
            className={cn(
              "h-3.5 w-3.5 transition-opacity",
              isActive ? "opacity-100" : "opacity-50",
            )}
          />
        </button>
      )}
    </th>
  );
}

const SortableTableHead = React.forwardRef(SortableTableHeadInner) as <
  K extends string,
>(
  props: SortableTableHeadProps<K> & { ref?: React.Ref<HTMLTableCellElement> },
) => ReturnType<typeof SortableTableHeadInner>;

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
};
