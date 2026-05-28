"use client";

import { ShieldX, ArrowLeft, LayoutDashboard, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-10">
      {/* Decorative background — soft blurred orbs */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-rose-300/30 blur-3xl dark:bg-rose-500/10" />
        <div className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-400/5" />
      </div>

      {/* Glass card */}
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/50 bg-white/70 px-5 py-8 text-center shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] backdrop-blur-2xl backdrop-saturate-150 sm:px-12 sm:py-12 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      >
        {/* Top accent ribbon */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

        {/* Status chip */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-rose-200/70 bg-rose-50/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
          </span>
          Error 403
        </div>

        {/* Icon — layered glow + tile */}
        <div className="relative mx-auto mb-6 inline-flex">
          <span
            className="absolute inset-0 -z-10 rounded-3xl bg-rose-500/30 blur-2xl"
            aria-hidden
          />
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/40 ring-1 ring-inset ring-white/30">
            <ShieldX className="h-10 w-10 text-white" strokeWidth={2.25} />
          </div>
        </div>

        {/* Heading */}
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Access Denied
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          You don&apos;t have permission to view this page. If you believe this
          is a mistake, reach out to your administrator and we&apos;ll get you
          sorted.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="h-11 rounded-xl border-border/70 bg-white/60 px-5 backdrop-blur hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="h-11 rounded-xl bg-gradient-to-br from-primary to-secondary px-5 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Footer help link */}
        <div className="mt-7 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <span>Need access?</span>
          <a
            href="mailto:admin@frogtask.app"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Contact your administrator
          </a>
        </div>
      </div>
    </div>
  );
}
