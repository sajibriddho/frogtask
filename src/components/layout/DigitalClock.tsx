"use client";

/**
 * DigitalClock – renders the current time + date in the Topbar.
 * Uses fixed defaults (UTC, YYYY-MM-DD) supplied by `useAppSettings`.
 *
 * Ticks once per second using a single interval.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/hooks/useBranding";

type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD-MMM-YYYY";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Break a Date into its Y/M/D/H/Mi/S/Weekday parts in a given IANA
 * timezone. We can't simply use `toLocaleString` piecemeal because that
 * makes per-part parsing brittle across locales — so we use
 * `Intl.DateTimeFormat.formatToParts` which gives each field by name.
 */
function partsInTimezone(d: Date, timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    return {
      year: map.year ?? "",
      month: map.month ?? "",
      day: map.day ?? "",
      hour: map.hour === "24" ? "00" : (map.hour ?? ""),
      minute: map.minute ?? "",
      second: map.second ?? "",
      weekday: map.weekday ?? "",
    };
  } catch {
    // Fallback: invalid timezone string → use UTC
    return partsInTimezone(d, "UTC");
  }
}

/**
 * Compute the short UTC offset for the given IANA zone at the given
 * instant (e.g. "UTC+06:00", "UTC-05:00"). Uses `longOffset` which is
 * supported by every modern engine.
 */
function utcOffsetIn(d: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(d);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return raw.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

/**
 * Shorten an IANA zone for compact display — drops the continent prefix
 * and converts underscores to spaces (so "Asia/Dhaka" → "Dhaka",
 * "America/New_York" → "New York", "UTC" stays "UTC").
 */
function shortZone(timeZone: string): string {
  if (!timeZone || timeZone === "UTC") return "UTC";
  const last = timeZone.split("/").pop() ?? timeZone;
  return last.replace(/_/g, " ");
}

function formatDate(
  parts: ReturnType<typeof partsInTimezone>,
  fmt: DateFormat,
): string {
  const monthIdx = Math.max(0, Math.min(11, Number(parts.month) - 1));
  const monthShort = MONTHS_SHORT[monthIdx];
  switch (fmt) {
    case "DD/MM/YYYY":
      return `${parts.day}/${parts.month}/${parts.year}`;
    case "MM/DD/YYYY":
      return `${parts.month}/${parts.day}/${parts.year}`;
    case "DD-MMM-YYYY":
      return `${parts.day}-${monthShort}-${parts.year}`;
    case "YYYY-MM-DD":
    default:
      return `${parts.year}-${parts.month}-${parts.day}`;
  }
}

export function DigitalClock({ className }: { className?: string }) {
  const appSettings = useAppSettings();
  const timezone = appSettings.timezone || "UTC";
  const dateFormat = (appSettings.dateFormat || "YYYY-MM-DD") as DateFormat;
  const [now, setNow] = React.useState<Date | null>(null);

  // Tick once per second. Only starts after first client render, which
  // also avoids the SSR/hydration mismatch that would otherwise occur.
  React.useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    // Placeholder to preserve layout width until mount
    return (
      <div
        className={cn(
          "hidden md:flex flex-col items-end justify-center h-10 w-[180px]",
          className,
        )}
        aria-hidden
      />
    );
  }

  const parts = partsInTimezone(now, timezone);
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  const dateStr = formatDate(parts, dateFormat);
  const offset = utcOffsetIn(now, timezone);
  const zoneLabel = shortZone(timezone);
  const offsetShort = offset ? offset.replace("UTC", "") : "";

  return (
    <div
      className={cn(
        "hidden md:flex flex-col items-end justify-center gap-1 px-2",
        className,
      )}
      title={`${timezone}${offset ? ` (${offset})` : ""}`}
      aria-label={`Current time ${time} in ${timezone}`}
    >
      {/* Top line: pulse + time */}
      <div className="flex items-center gap-1.5 leading-none">
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground tracking-tight">
          {time}
        </span>
      </div>

      {/* Bottom line: weekday · date · zone */}
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground leading-none whitespace-nowrap">
        <span>{parts.weekday}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span>{dateStr}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span className="text-primary/80 normal-case tracking-normal font-semibold">
          {zoneLabel}
          {offsetShort && (
            <span className="ml-0.5 font-mono opacity-80">{offsetShort}</span>
          )}
        </span>
      </div>
    </div>
  );
}
