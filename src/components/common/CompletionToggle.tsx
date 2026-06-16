"use client";

/**
 * CompletionToggle — the single, shared "tick this task off" control used
 * on Today, Dashboard, and All Tasks.
 *
 * Sized to match the surrounding text line-height (h-5 for text-sm, h-4
 * for text-xs) so it sits flush with `items-start` rows — no nudging,
 * no shift when the row gets a strikethrough.
 *
 * Visuals: SVG check that *draws in* on transition via stroke-dashoffset;
 * emerald gradient fill when checked; a permanent soft inner glow plus a
 * one-shot ring-burst on the check→complete transition. Pending swaps the
 * face for a ring + spinner with the exact same box dimensions, so rows
 * never reflow mid-request.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompletionToggleProps {
  checked: boolean;
  pending?: boolean;
  disabled?: boolean;
  /** sm — for dense lists (Dashboard); md — for primary rows (Today/Tasks). */
  size?: "sm" | "md";
  /**
   * Called with the next checked value and the screen-space centre of the
   * toggle at click time — so the celebration burst can fly from the row
   * the user actually clicked, not from the centre of the viewport.
   */
  onChange: (next: boolean, origin?: { x: number; y: number }) => void;
  ariaLabel?: string;
  className?: string;
}

export function CompletionToggle({
  checked,
  pending = false,
  disabled = false,
  size = "md",
  onChange,
  ariaLabel,
  className,
}: CompletionToggleProps) {
  // Sized to match the line height of the row's primary text so the
  // toggle aligns naturally with `items-start` — no `mt-` hacks needed.
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const iconDim = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  // Track previous checked state so we can fire the ring-burst exactly
  // once per check→uncheck→check cycle (key flip = animation restart).
  const [burstKey, setBurstKey] = React.useState(0);
  const prevChecked = React.useRef(checked);
  React.useEffect(() => {
    if (!prevChecked.current && checked) setBurstKey((k) => k + 1);
    prevChecked.current = checked;
  }, [checked]);

  if (pending) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border-2 border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-500/10 box-border align-middle",
          dim,
          className,
        )}
        role="status"
        aria-label="Saving"
      >
        <Loader2 className={cn("animate-spin text-emerald-500", iconDim)} />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onChange(!checked, {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={
        ariaLabel ?? (checked ? "Reopen task" : "Mark task complete")
      }
      className={cn(
        "completion-toggle relative inline-flex shrink-0 items-center justify-center rounded-full border-2 box-border align-middle p-0 transition-[background,border-color,transform,box-shadow] duration-200 ease-out",
        dim,
        checked
          ? "border-emerald-500 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.18),0_4px_10px_-2px_rgba(16,185,129,0.45)]"
          : "border-muted-foreground/35 bg-background hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:scale-110 active:scale-90",
        className,
      )}
    >
      {/* Subtle inner highlight when checked (glossy feel). */}
      {checked && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0.5 rounded-full bg-gradient-to-b from-white/40 to-transparent"
        />
      )}

      {/* SVG check — draws in via stroke-dashoffset transition. */}
      <svg
        viewBox="0 0 24 24"
        className={cn("relative", iconDim)}
        aria-hidden
      >
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 26,
            strokeDashoffset: checked ? 0 : 26,
            transition:
              "stroke-dashoffset 300ms cubic-bezier(0.65, 0, 0.35, 1)",
            transitionDelay: checked ? "60ms" : "0ms",
            opacity: checked ? 1 : 0,
          }}
        />
      </svg>

      {/* One-shot expanding ring fired every time the user marks complete. */}
      {checked && (
        <span
          key={burstKey}
          aria-hidden
          className="completion-toggle-burst pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400"
        />
      )}
    </button>
  );
}
