"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 inline-block rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
            positionClasses[side],
            className
          )}
        >
          {content}
        </span>
      )}
    </div>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function TooltipTrigger({
  asChild,
  children,
  ...props
}: { asChild?: boolean; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  if (asChild && React.isValidElement(children)) return <>{children}</>;
  return <span {...props}>{children}</span>;
}

export function TooltipContent({
  children,
  className,
  side = "top",
  ...props
}: { children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" } & React.HTMLAttributes<HTMLSpanElement>) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  return (
    <span
      role="tooltip"
      className={cn(
        "absolute z-50 inline-block rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
        positionClasses[side],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
