"use client";

/**
 * Public marketing landing page.
 *
 * Hero → social-proof strip → feature grid → workflow → bottom CTA →
 * footer. The page is **fully public** — no session detection, no
 * conditional CTAs. Every visitor sees the same `Sign in` / `Get
 * started` buttons. Detecting auth client-side is unreliable (a stale
 * NextAuth cookie reports "authenticated" even when the server-side
 * middleware would reject the same cookie for permission reasons),
 * which is why every major SaaS landing page (Stripe, Notion, Linear,
 * Todoist, etc.) keeps the public surface consistent. Auth-aware
 * forwarding belongs on `/login`, not here.
 *
 * All branding (logo, name) comes from `useBranding` so a self-hosted
 * instance can re-skin without code changes.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Sun,
  ListChecks,
  Repeat,
  CalendarDays,
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  Star,
  Zap,
  MoonStar,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FrogIcon } from "@/components/icons/FrogIcon";
import { useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";

// ─── Feature catalogue ─────────────────────────────────────────────────

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  tone: "primary" | "amber" | "sky" | "rose" | "emerald" | "violet";
}

const FEATURES: Feature[] = [
  {
    icon: Sun,
    title: "Daily task planning",
    description:
      "Start every morning with a focused list. Knock items off as you go.",
    tone: "amber",
  },
  {
    icon: ListChecks,
    title: "Today's tasks",
    description:
      "A single screen for what matters now. Strikethrough, reopen, remarks — done.",
    tone: "primary",
  },
  {
    icon: Repeat,
    title: "Recurring tasks",
    description:
      "Daily and weekly schedules that quietly show up when they should.",
    tone: "sky",
  },
  {
    icon: CalendarDays,
    title: "Calendar view",
    description:
      "See the whole month at a glance. Click any day for the full breakdown.",
    tone: "violet",
  },
  {
    icon: LayoutDashboard,
    title: "Productivity dashboard",
    description:
      "Pending, completed, upcoming — the numbers you actually look at.",
    tone: "rose",
  },
  {
    icon: ShieldCheck,
    title: "Roles & permissions",
    description:
      "Built-in admin controls so teams can grow without losing the simple feel.",
    tone: "emerald",
  },
];

const TONE_BG: Record<Feature["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

// ─── Page ──────────────────────────────────────────────────────────────

export function LandingPage() {
  const { companyName, companyLogo } = useBranding();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--body-bg)] text-foreground">
      {/* Ambient backdrop */}
      <BackdropDecor />

      <SiteHeader companyName={companyName} companyLogo={companyLogo} />
      <Hero />
      <SocialProofStrip />
      <FeaturesSection />
      <WorkflowSection />
      <BottomCTA />
      <SiteFooter companyName={companyName} />
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────

function BackdropDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-primary/5 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-secondary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-72 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
    </>
  );
}

function SiteHeader({
  companyName,
  companyLogo,
}: {
  companyName: string;
  companyLogo: string;
}) {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex max-w-(--breakpoint-xl) items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          {companyLogo ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card p-1.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={companyLogo}
                alt={companyName}
                className="h-full w-full object-contain"
              />
            </span>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              <FrogIcon className="h-5 w-5" strokeWidth={2.5} />
            </span>
          )}
          <span className="text-lg font-bold tracking-tight" title={companyName}>
            {companyName}
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Button
            asChild
            variant="ghost"
            className="rounded-xl text-sm font-medium"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-xl text-sm font-semibold">
            <Link href="/register">
              Get started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative z-10 mx-auto max-w-(--breakpoint-xl) px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-20 lg:pb-24 lg:pt-28">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          A productivity tool that gets out of your way
        </span>

        <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-[68px] lg:leading-[1.05]">
          Plan your day.
          <br className="hidden sm:block" />{" "}
          <span className="bg-gradient-to-br from-primary via-primary to-secondary bg-clip-text text-transparent">
            Finish your week.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          A clean, focused task planner with daily lists, recurring schedules,
          and a calendar view — built for people who&rsquo;d rather do the work
          than configure the tool.
        </p>

        {/* CTA cluster */}
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl px-6 text-base font-semibold w-full sm:w-auto shadow-md shadow-primary/20"
          >
            <Link href="/register">
              Create your account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-xl px-6 text-base font-semibold w-full sm:w-auto"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        {/* Sub-line */}
        <p className="mt-5 text-xs text-muted-foreground">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary align-text-bottom" />
          Free to use
          <span className="mx-2 text-border">·</span>
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary align-text-bottom" />
          Sign up takes a minute
          <span className="mx-2 text-border">·</span>
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-primary align-text-bottom" />
          Light &amp; dark mode
        </p>
      </motion.div>

      {/* Hero preview */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut", delay: 0.18 }}
        className="mx-auto mt-14 max-w-4xl sm:mt-20"
      >
        <HeroPreview />
      </motion.div>
    </section>
  );
}

function SocialProofStrip() {
  const stats = [
    { label: "Tasks completed every day", value: "Daily" },
    { label: "Light &amp; dark mode", value: "Themed" },
    { label: "Powered by your data only", value: "Private" },
    { label: "Time spent fiddling", value: "Zero" },
  ];
  return (
    <section className="relative z-10 border-y border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="mx-auto max-w-(--breakpoint-xl) px-4 py-6 sm:px-6 sm:py-8">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {stats.map((s) => (
            <li key={s.label} className="text-center">
              <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {s.value}
              </p>
              <p
                className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: s.label }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="relative z-10 mx-auto max-w-(--breakpoint-xl) px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Star className="h-3 w-3 text-primary" />
          Features
        </span>
        <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need.
          <br className="hidden sm:block" />{" "}
          <span className="text-muted-foreground">Nothing you don&rsquo;t.</span>
        </h2>
        <p className="mt-4 text-pretty text-sm text-muted-foreground sm:text-base">
          The core moves of a good productivity app, done well — without
          project boards, dependency graphs, or AI fluff you&rsquo;ll never use.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps = [
    {
      n: "01",
      icon: Zap,
      title: "Capture it",
      body: "Drop in tasks for today, a specific date, or set them to repeat daily or weekly.",
    },
    {
      n: "02",
      icon: Sun,
      title: "Plan your day",
      body: "Open Today and see only what matters. No project hierarchies in your face.",
    },
    {
      n: "03",
      icon: CheckCircle2,
      title: "Cross them off",
      body: "One click marks done with optional remarks. Recurring schedules keep going.",
    },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-(--breakpoint-xl) px-4 pb-16 sm:px-6 sm:pb-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <ChevronRight className="h-3 w-3 text-primary" />
          How it works
        </span>
        <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Three moves. That&rsquo;s the workflow.
        </h2>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="relative z-10 mx-auto max-w-(--breakpoint-xl) px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-8 text-center sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-secondary/20 blur-3xl"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <MoonStar className="h-3 w-3" />
            Ready when you are
          </span>
          <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Clear your list. Reclaim your week.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Sign up, plan your day, finish your week. That&rsquo;s the whole
            pitch.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl px-6 text-base font-semibold w-full sm:w-auto shadow-md shadow-primary/20"
            >
              <Link href="/register">
                Get started for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-xl px-6 text-base font-semibold w-full sm:w-auto"
            >
              <Link href="/login">Already have an account?</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="relative z-10 border-t border-border/60 bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()}{" "}
          <span className="font-medium text-foreground">{companyName}</span>.
          All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign up
          </Link>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot password
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Building blocks ───────────────────────────────────────────────────

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={cn(
        "group relative rounded-2xl border border-border bg-card p-5 transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          TONE_BG[feature.tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {feature.title}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </motion.div>
  );
}

/** A non-interactive preview "screenshot" rendered with the live theme. */
function HeroPreview() {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-2xl shadow-primary/10 overflow-hidden">
      {/* Mock toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Sun className="h-3 w-3 text-amber-500" />
          Today
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          ⌘K
        </span>
      </div>

      <div className="grid gap-0 sm:grid-cols-[1fr_220px]">
        {/* Task list */}
        <div className="space-y-2 p-4 sm:p-5">
          {[
            {
              title: "Morning standup notes",
              done: true,
              prio: "bg-emerald-500",
              meta: "Daily",
            },
            {
              title: "Review Q3 task report",
              done: false,
              prio: "bg-sky-500",
              meta: "Today",
            },
            {
              title: "Reply to design feedback",
              done: false,
              prio: "bg-amber-500",
              meta: "Today",
            },
            {
              title: "Plan tomorrow's focus block",
              done: false,
              prio: "bg-rose-500",
              meta: "Weekly",
            },
          ].map((t, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-background/50 px-3 py-2.5 transition-all",
                t.done && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                  t.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {t.done && <CheckCircle2 className="h-3.5 w-3.5" />}
              </span>
              <span
                className={cn(
                  "flex-1 text-sm font-medium text-foreground",
                  t.done && "line-through text-muted-foreground",
                )}
              >
                {t.title}
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t.meta}
              </span>
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.prio)}
              />
            </div>
          ))}
        </div>

        {/* Side panel */}
        <div className="border-t border-border bg-muted/30 p-4 sm:border-l sm:border-t-0 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            This week
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              { day: "Mon", count: 4 },
              { day: "Tue", count: 6 },
              { day: "Wed", count: 3 },
              { day: "Thu", count: 5 },
              { day: "Fri", count: 2 },
            ].map((d) => (
              <div key={d.day} className="flex items-center gap-2">
                <span className="w-8 text-[11px] font-semibold text-muted-foreground">
                  {d.day}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-card">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${(d.count / 6) * 100}%` }}
                  />
                </div>
                <span className="w-4 text-right text-[11px] font-semibold tabular-nums text-foreground">
                  {d.count}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Up next
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground">
              Sprint review
            </p>
            <p className="text-[11px] text-muted-foreground">
              Tomorrow · 10:00
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
