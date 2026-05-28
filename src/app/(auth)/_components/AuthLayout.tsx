"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FrogIcon } from "@/components/icons/FrogIcon";
import { useBranding } from "@/hooks/useBranding";

/**
 * Minimal, centered auth shell. Off-white surface, a thin primary
 * hairline at the top edge, and a single rounded card. No background
 * patterns, orbs, or animated decoration — visual quiet on purpose.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-[var(--body-bg)]">
      {/* A barely-there gradient hairline along the top edge — the only
          decoration on the page. Reads as a brand accent without
          competing with the form. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          <BrandMark />
          <div className="rounded-2xl border border-border bg-card p-7 sm:p-8">
            {children}
          </div>
          <Footer />
        </motion.div>
      </div>
    </div>
  );
}

/** Compact brand mark above the card — icon, name, tiny tagline. */
function BrandMark() {
  const { companyName, companyLogo } = useBranding();
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {companyLogo ? (
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-card border border-border p-1.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={companyLogo}
            alt={companyName}
            className="h-full w-full object-contain"
          />
        </Link>
      ) : (
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"
        >
          <FrogIcon className="h-5 w-5" strokeWidth={2.5} />
        </Link>
      )}
      <span
        className="mt-3 text-base font-semibold text-foreground tracking-tight truncate max-w-full"
        title={companyName}
      >
        {companyName}
      </span>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
      <Link
        href="/"
        className="hover:text-foreground transition-colors"
      >
        ← Back to home
      </Link>
      <span aria-hidden className="text-border">·</span>
      <Link
        href="/forgot-password"
        className="hover:text-foreground transition-colors"
      >
        Need help?
      </Link>
    </div>
  );
}
