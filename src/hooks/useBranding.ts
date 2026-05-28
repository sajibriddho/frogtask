"use client";

/**
 * App-wide settings hook.
 *
 *   useAppSettings() → full public settings (branding + contact + locale)
 *                      with formatters.
 *   useBranding()    → narrow subset (company name / logo / favicon) that
 *                      pre-auth surfaces like /login use.
 *
 * Both are thin wrappers over a single module-level cache, so every caller
 * across the tree shares one network round-trip.
 */

import * as React from "react";
import { parseJsonSafe } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

export interface AppSettings {
  // Branding
  companyName: string;
  companyLogo: string;
  companyFavicon: string;
  defaultCountry: string;
  defaultLanguage: string;
  // Contact
  phone: string;
  email: string;
  website: string;
  businessHours: string;
  address: string;
  // Locale / money — fixed defaults, no longer user-configurable.
  timezone: string;
  dateFormat: string;
  currency: string;
  currencySymbol: string;
}

export interface Branding {
  companyName: string;
  companyLogo: string;
  companyFavicon: string;
}

// ── Defaults ───────────────────────────────────────────────────────────

const FALLBACK: AppSettings = {
  companyName: "Frogtask",
  companyLogo: "",
  companyFavicon: "",
  defaultCountry: "US",
  defaultLanguage: "en",
  phone: "",
  email: "",
  website: "",
  businessHours: "",
  address: "",
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
  currency: "USD",
  currencySymbol: "$",
};

// ── Module-level cache ─────────────────────────────────────────────────

let cache: AppSettings | null = null;
let inflight: Promise<AppSettings> | null = null;
const listeners = new Set<(s: AppSettings) => void>();

interface ApiShape {
  company_name?: string;
  company_logo?: string;
  company_favicon?: string;
  default_country?: string;
  default_language?: string;
  phone?: string;
  email?: string;
  website?: string;
  business_hours?: string;
  address?: string;
}

function mapShape(d: ApiShape | undefined): AppSettings {
  if (!d) return FALLBACK;
  return {
    companyName: (d.company_name || "").trim() || FALLBACK.companyName,
    companyLogo: d.company_logo || "",
    companyFavicon: d.company_favicon || "",
    defaultCountry: d.default_country || FALLBACK.defaultCountry,
    defaultLanguage: d.default_language || FALLBACK.defaultLanguage,
    phone: d.phone || "",
    email: d.email || "",
    website: d.website || "",
    businessHours: d.business_hours || "",
    address: d.address || "",
    timezone: FALLBACK.timezone,
    dateFormat: FALLBACK.dateFormat,
    currency: FALLBACK.currency,
    currencySymbol: FALLBACK.currencySymbol,
  };
}

async function fetchSettings(): Promise<AppSettings> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/settings/public", { cache: "no-store" });
      const json = await parseJsonSafe<{ success: boolean; data?: ApiShape }>(
        res,
      );
      const next = mapShape(json.data);
      cache = next;
      listeners.forEach((cb) => cb(next));
      return next;
    } catch {
      cache = FALLBACK;
      listeners.forEach((cb) => cb(FALLBACK));
      return FALLBACK;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// ── Hooks ──────────────────────────────────────────────────────────────

/** Full public settings — use this on every invoice / receipt / report. */
export function useAppSettings(): AppSettings {
  const [settings, setSettings] = React.useState<AppSettings>(
    cache ?? FALLBACK,
  );

  React.useEffect(() => {
    let cancelled = false;
    const onUpdate = (s: AppSettings) => {
      if (!cancelled) setSettings(s);
    };
    listeners.add(onUpdate);
    void fetchSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
      listeners.delete(onUpdate);
    };
  }, []);

  return settings;
}

/** Narrow branding subset — used by pre-auth pages (login). */
export function useBranding(): Branding {
  const s = useAppSettings();
  return {
    companyName: s.companyName,
    companyLogo: s.companyLogo,
    companyFavicon: s.companyFavicon,
  };
}

/** Invalidate the cache so every live consumer re-renders with fresh data. */
export function refreshAppSettings(): Promise<AppSettings> {
  cache = null;
  inflight = null;
  return fetchSettings();
}
export const refreshBranding = refreshAppSettings;

/**
 * Synchronous accessor for non-React code (lib utilities, chart tick
 * formatters, top-level module helpers). Returns the current cached
 * settings or the FALLBACK snapshot when the cache hasn't been
 * populated yet. Safe to call anywhere — never throws, never blocks.
 */
export function getCachedAppSettings(): AppSettings {
  return cache ?? FALLBACK;
}

// ── Formatters (pure helpers, keyed on current settings) ───────────────

/**
 * Format a number as a money string using the configured currency.
 * Uses `Intl.NumberFormat` with the 3-letter currency code when possible;
 * falls back to the literal `currencySymbol` prefix if the code is
 * unknown to the runtime.
 */
export function formatMoney(
  value: number | null | undefined,
  settings: Pick<AppSettings, "currency" | "currencySymbol">,
  opts: { decimals?: number; short?: boolean } = {},
): string {
  const n = Number(value) || 0;
  const decimals = opts.decimals ?? 2;

  if (opts.short) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000)
      return `${settings.currencySymbol}${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)
      return `${settings.currencySymbol}${(n / 1_000).toFixed(1)}k`;
  }

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: settings.currency || "USD",
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `${settings.currencySymbol}${n.toLocaleString("en", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Format a date using the timezone + date format stored in Settings. */
export function formatSettingsDate(
  value: Date | string | null | undefined,
  settings: Pick<AppSettings, "timezone" | "dateFormat">,
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const y = get("year");
    const m = get("month");
    const dd = get("day");
    const monthShort = MONTHS_SHORT[Math.max(0, Number(m) - 1)] ?? "";
    switch (settings.dateFormat) {
      case "DD/MM/YYYY":
        return `${dd}/${m}/${y}`;
      case "MM/DD/YYYY":
        return `${m}/${dd}/${y}`;
      case "DD-MMM-YYYY":
        return `${dd}-${monthShort}-${y}`;
      case "YYYY-MM-DD":
      default:
        return `${y}-${m}-${dd}`;
    }
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
