"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/providers/ThemeProvider";

/**
 * Global toast renderer. Modern glassmorphism card with a colored
 * vertical accent bar, soft tinted shadow, and refined typography.
 */
export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={3500}
      visibleToasts={4}
      offset={20}
      gap={10}
      theme={theme}
      toastOptions={{
        classNames: {
          toast: [
            "group/toast relative overflow-hidden",
            "flex items-start gap-3",
            "rounded-2xl border border-white/40 dark:border-white/10",
            "bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl backdrop-saturate-150",
            "text-foreground",
            "shadow-[0_10px_40px_-12px_rgba(15,23,42,0.25),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
            "ring-1 ring-black/[0.04] dark:ring-white/[0.04]",
            "px-4 py-3.5 pr-10",
            // Left accent bar — color set per variant below
            "before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3",
            "before:w-[3px] before:rounded-full before:bg-primary/70",
          ].join(" "),
          title: "text-[13px] font-semibold tracking-tight leading-snug",
          description:
            "text-[12px] text-muted-foreground leading-relaxed mt-0.5",
          icon: [
            "flex h-7 w-7 shrink-0 items-center justify-center",
            "rounded-lg ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]",
            "[&>svg]:h-4 [&>svg]:w-4",
          ].join(" "),
          actionButton: [
            "rounded-lg bg-primary text-primary-foreground",
            "text-xs font-semibold px-3 py-1.5",
            "hover:bg-primary/90 transition-colors",
            "shadow-sm",
          ].join(" "),
          cancelButton: [
            "rounded-lg bg-muted text-foreground",
            "text-xs font-medium px-3 py-1.5",
            "hover:bg-muted/80 transition-colors",
          ].join(" "),
          // Close button is fully styled via global CSS in
          // styles/custom-components.css to beat sonner's inline defaults.
          // Variant accents — recolor the left bar + soften the icon tile
          success: [
            "before:!bg-emerald-500",
            "[&>[data-icon]]:!bg-emerald-50 [&>[data-icon]]:!text-emerald-600",
            "dark:[&>[data-icon]]:!bg-emerald-500/15 dark:[&>[data-icon]]:!text-emerald-300",
            "shadow-[0_10px_40px_-12px_rgba(16,185,129,0.35),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
          ].join(" "),
          error: [
            "before:!bg-rose-500",
            "[&>[data-icon]]:!bg-rose-50 [&>[data-icon]]:!text-rose-600",
            "dark:[&>[data-icon]]:!bg-rose-500/15 dark:[&>[data-icon]]:!text-rose-300",
            "shadow-[0_10px_40px_-12px_rgba(244,63,94,0.35),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
          ].join(" "),
          info: [
            "before:!bg-primary",
            "[&>[data-icon]]:!bg-primary/10 [&>[data-icon]]:!text-primary",
            "shadow-[0_10px_40px_-12px_rgba(37,99,235,0.35),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
          ].join(" "),
          warning: [
            "before:!bg-amber-500",
            "[&>[data-icon]]:!bg-amber-50 [&>[data-icon]]:!text-amber-600",
            "dark:[&>[data-icon]]:!bg-amber-500/15 dark:[&>[data-icon]]:!text-amber-300",
            "shadow-[0_10px_40px_-12px_rgba(245,158,11,0.35),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
          ].join(" "),
        },
      }}
    />
  );
}
