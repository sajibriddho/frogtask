"use client";

/**
 * BrandingApplier — keeps the live <title> and <link rel="icon"> in sync
 * with the company name / favicon stored in Settings. Mounted once at
 * the root so saving Settings updates the browser tab immediately without
 * needing a page reload. Consumers that format money, dates, or invoices
 * rely on the same `useAppSettings` cache and re-render themselves; this
 * component only handles the document-level bits React can't reach.
 */

import * as React from "react";
import { useAppSettings } from "@/hooks/useBranding";

export function BrandingApplier() {
  const { companyName, companyFavicon } = useAppSettings();

  // ── Document title (browser tab label) ────────────────────────────────
  // Tab title is just the company name from Settings. While settings
  // are still loading the initial `<title>` from the Next metadata in
  // `app/layout.tsx` is displayed, so we never flash an empty string.
  React.useEffect(() => {
    const next = (companyName || "").trim();
    if (!next) return;
    if (document.title !== next) document.title = next;
  }, [companyName]);

  // ── Favicon (browser tab icon) ────────────────────────────────────────
  // Mirrors the `company_favicon` setting. When the setting is blank
  // we fall back to `/favicon.ico` so the tab never loses its icon
  // even during the brief period before settings hydrate.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const href = (companyFavicon && companyFavicon.trim()) || "/favicon.ico";
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    // Compare as strings (absolute URL) so we don't thrash the element.
    if (new URL(link.href, window.location.origin).href !==
        new URL(href, window.location.origin).href) {
      link.href = href;
    }
  }, [companyFavicon]);

  return null;
}
