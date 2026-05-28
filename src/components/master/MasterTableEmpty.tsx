"use client";

import { Inbox, SearchX } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

interface MasterTableEmptyProps {
  colSpan: number;
  hasSearch?: boolean;
  messageEmpty?: string;
  messageSearch?: string;
}

export function MasterTableEmpty({
  colSpan,
  hasSearch = false,
  messageEmpty = "No records found",
  messageSearch = "No results match your search",
}: MasterTableEmptyProps) {
  const Icon = hasSearch ? SearchX : Inbox;
  const message = hasSearch ? messageSearch : messageEmpty;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-16">
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Icon className="h-8 w-8" />
          <p className="text-sm">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
