"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MasterTableHeaderProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Pass `undefined` to hide the add button (e.g. user lacks the create permission). */
  onAddClick?: () => void;
  addLabel?: string;
}

export function MasterTableHeader({
  icon: Icon,
  title,
  description,
  searchValue,
  onSearchChange,
  onAddClick,
  addLabel = "Add new",
}: MasterTableHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:flex-shrink-0">
        <div className="relative flex-1 sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="pl-9"
          />
        </div>
        {onAddClick && (
          <Button onClick={onAddClick} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
