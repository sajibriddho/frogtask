"use client";

/**
 * Global 404 page.
 *
 * Next.js App Router auto-renders this whenever no route matches — both
 * for hard navigations and for `notFound()` calls from server components.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, LayoutDashboard, Compass, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();
  const { companyName } = useBranding();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground flex flex-col">
      {/* Decorative background — soft blurred color orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl dark:bg-primary/15" />
        <div className="absolute top-1/4 right-0 h-96 w-96 translate-x-1/3 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-500/10" />
      </div>

      {/* Subtle dotted grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_1px_1px,theme(colors.foreground/8)_1px,transparent_0)] [background-size:24px_24px] opacity-50"
      />

      {/* Top bar — brand chip */}
      <header className="relative z-10 flex items-center justify-start px-4 sm:px-10 pt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-3 py-1.5 backdrop-blur-md shadow-sm hover:border-primary/40 hover:shadow-md transition-all dark:border-white/10 dark:bg-white/[0.04]"
          title={companyName}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary ring-1 ring-inset ring-white/30">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-foreground/80 truncate max-w-[160px]">
            {companyName}
          </span>
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 sm:px-10 py-10">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-4xl"
        >
          {/* Glass card wrapper */}
          <div className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/65 px-4 py-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur-2xl backdrop-saturate-150 sm:px-12 sm:py-14 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
            {/* Top accent ribbon */}
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent" />

            <div className="flex flex-col md:flex-row md:items-stretch gap-8 md:gap-12">
              {/* Left: huge animated 404 */}
              <div className="md:w-5/12 flex flex-col items-center md:items-start justify-center">
                {/* Status chip */}
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary dark:border-primary/30 dark:bg-primary/15">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  Error 404
                </div>

                <h1
                  aria-label="404 — page not found"
                  className="relative select-none text-[80px] sm:text-[150px] md:text-[170px] font-black leading-[0.85] tracking-tighter"
                >
                  <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
                    4
                  </span>
                  <span className="relative inline-flex items-center justify-center mx-1">
                    <span className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                      0
                    </span>
                    {/* Floating compass inside the 0 */}
                    <motion.span
                      aria-hidden
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Compass className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 text-primary/30" strokeWidth={1.5} />
                    </motion.span>
                  </span>
                  <span className="bg-gradient-to-br from-secondary to-primary bg-clip-text text-transparent">
                    4
                  </span>
                </h1>
              </div>

              {/* Vertical divider */}
              <div
                aria-hidden="true"
                className="hidden md:block w-px bg-gradient-to-b from-transparent via-border to-transparent"
              />
              <div
                aria-hidden="true"
                className="md:hidden h-px bg-gradient-to-r from-transparent via-border to-transparent"
              />

              {/* Right: message + actions */}
              <div className="md:flex-1 flex flex-col justify-center">
                <h2 className="text-2xl sm:text-3xl md:text-[28px] font-bold tracking-tight text-foreground">
                  Lost in space?
                </h2>
                <p className="mt-3 text-sm sm:text-[15px] text-muted-foreground leading-relaxed max-w-md">
                  The page you&apos;re looking for doesn&apos;t exist, has been
                  moved, or the link you followed is broken. Let&apos;s get you
                  back on track.
                </p>

                {/* Requested path */}
                {pathname && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 py-2 max-w-full backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                      Requested
                    </span>
                    <code className="text-xs font-mono text-foreground/90 truncate">
                      {pathname}
                    </code>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-7 flex flex-col-reverse sm:flex-row gap-2.5">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => router.back()}
                    className="group h-11 rounded-xl border-border/70 bg-white/60 backdrop-blur hover:border-primary/40 hover:bg-white transition-all dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                    Go back
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    className="group h-11 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
                  >
                    <Link href="/dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Go to dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-10 pb-6">
        <p className="text-center text-[11px] text-muted-foreground">
          If you believe this is a mistake, contact your administrator.
        </p>
      </footer>
    </div>
  );
}
