import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline `<Alert>` banner — soft tinted surface with a colored left
 * accent bar and an icon tile. Variant choice picks the colour.
 *
 * Two ways to use it:
 *   <Alert variant="info">
 *     <AlertTitle>...</AlertTitle>
 *     <AlertDescription>...</AlertDescription>
 *   </Alert>
 *
 * Or supply your own icon as the first child (legacy API kept):
 *   <Alert variant="info">
 *     <ShieldCheck className="h-4 w-4" />
 *     <AlertTitle>...</AlertTitle>
 *     <AlertDescription>...</AlertDescription>
 *   </Alert>
 */

const alertVariants = cva(
  // Base: glassy card with a thin rounded accent bar on the left,
  // soft variant-tinted shadow, and refined typography.
  [
    "group/alert relative w-full overflow-hidden text-sm",
    "rounded-2xl border backdrop-blur-xl backdrop-saturate-150",
    "py-3.5 pl-5 pr-4",
    // Vertical accent bar (color set per variant)
    "before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3",
    "before:w-[3px] before:rounded-full",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-card/70 border-border/60 text-foreground",
          "shadow-[0_6px_24px_-12px_rgba(15,23,42,0.18)]",
          "before:bg-primary/70",
          "dark:bg-slate-900/60",
        ].join(" "),
        info: [
          "bg-primary/[0.06] border-primary/20 text-foreground",
          "shadow-[0_8px_28px_-12px_rgba(37,99,235,0.30)]",
          "before:bg-primary",
          "dark:bg-primary/10 dark:border-primary/30",
        ].join(" "),
        success: [
          "bg-emerald-50/80 border-emerald-200/70 text-emerald-950",
          "shadow-[0_8px_28px_-12px_rgba(16,185,129,0.30)]",
          "before:bg-emerald-500",
          "dark:bg-emerald-500/[0.08] dark:border-emerald-500/25 dark:text-emerald-100",
        ].join(" "),
        warning: [
          "bg-amber-50/80 border-amber-200/70 text-amber-950",
          "shadow-[0_8px_28px_-12px_rgba(245,158,11,0.30)]",
          "before:bg-amber-500",
          "dark:bg-amber-500/[0.08] dark:border-amber-500/25 dark:text-amber-100",
        ].join(" "),
        destructive: [
          "bg-rose-50/80 border-rose-200/70 text-rose-950",
          "shadow-[0_8px_28px_-12px_rgba(244,63,94,0.30)]",
          "before:bg-rose-500",
          "dark:bg-rose-500/[0.08] dark:border-rose-500/25 dark:text-rose-100",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const ICON_BY_VARIANT: Record<string, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

const ICON_TILE_BY_VARIANT: Record<string, string> = {
  default:
    "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15 dark:text-primary dark:ring-primary/30",
  info: "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15 dark:text-primary dark:ring-primary/30",
  success:
    "bg-emerald-100/80 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25",
  warning:
    "bg-amber-100/80 text-amber-700 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25",
  destructive:
    "bg-rose-100/80 text-rose-700 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25",
};

type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    /** Override the auto-picked variant icon. Set to `false` to hide it. */
    icon?: LucideIcon | false;
  };

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => {
    const v = variant ?? "default";

    // Detect the legacy "icon as first child" pattern: a single SVG
    // element passed as the first child. Pull it out so we can render
    // it inside the icon tile.
    let legacyIcon: React.ReactElement | null = null;
    const rest: React.ReactNode[] = [];
    React.Children.forEach(children, (child, i) => {
      if (
        i === 0 &&
        React.isValidElement(child) &&
        typeof child.type !== "string" &&
        // Cheap detection — Lucide icons render to <svg>. Anything that
        // looks like a small inline icon (no className extending it to
        // full-width) goes into the icon tile.
        true
      ) {
        // Only treat as icon if it's NOT an AlertTitle/AlertDescription.
        const displayName =
          (child.type as { displayName?: string })?.displayName;
        if (
          displayName !== "AlertTitle" &&
          displayName !== "AlertDescription"
        ) {
          legacyIcon = child;
          return;
        }
      }
      rest.push(child);
    });

    const ResolvedIcon =
      icon === false
        ? null
        : icon
          ? icon
          : legacyIcon
            ? null
            : ICON_BY_VARIANT[v] ?? Info;

    const showIconTile = legacyIcon || ResolvedIcon;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start gap-3">
          {showIconTile && (
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                ICON_TILE_BY_VARIANT[v] ?? ICON_TILE_BY_VARIANT.default,
              )}
              aria-hidden="true"
            >
              {legacyIcon
                ? React.cloneElement(legacyIcon as React.ReactElement<{ className?: string }>, {
                    className: cn(
                      "h-4 w-4",
                      (legacyIcon as React.ReactElement<{ className?: string }>).props
                        .className,
                    ),
                  })
                : ResolvedIcon
                  ? <ResolvedIcon className="h-4 w-4" />
                  : null}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-0.5">{rest}</div>
        </div>
      </div>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("text-[13.5px] font-semibold leading-snug tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[12.5px] leading-relaxed text-foreground/75 mt-0.5", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
