"use client";

import * as React from "react";
import { AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AlertDialog — confirm/cancel modal built on top of `Dialog`.
 *
 * Compact rounded card, color-coded icon tile in the header, two-button
 * footer. The destructive variant surfaces a red icon and a destructive
 * action button so the consequence is immediately legible.
 */
interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cancelLabel?: string;
  actionLabel?: string;
  onAction: () => void | Promise<void>;
  variant?: "default" | "destructive";
  loading?: boolean;
  className?: string;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Cancel",
  actionLabel = "Continue",
  onAction,
  variant = "default",
  loading = false,
  className,
}: AlertDialogProps) {
  const handleAction = async () => {
    await onAction();
    onOpenChange(false);
  };

  const isDestructive = variant === "destructive";
  const Icon = isDestructive ? AlertTriangle : HelpCircle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-sm rounded-2xl gap-5 p-6 sm:p-7", className)}
      >
        <DialogHeader className="space-y-3 text-left">
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              isDestructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <DialogTitle className="text-base font-semibold leading-tight">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-sm leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="flex-row justify-end gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleAction}
            disabled={loading}
            className="rounded-xl"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
