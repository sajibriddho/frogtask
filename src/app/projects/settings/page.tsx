"use client";

/**
 * Project Management — workspace settings & keyboard shortcuts.
 *
 * Shows roles cheat-sheet, keyboard shortcuts and quick links into the
 * boards / labels / archived screens. Module-wide settings live here so
 * each board doesn't need a separate one.
 */

import * as React from "react";
import Link from "next/link";
import {
  Settings,
  Users,
  Tag,
  Archive,
  KeyboardIcon,
  Shield,
  LayoutGrid,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ProjectsTabs } from "../_components/ProjectsTabs";

const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: "Esc", desc: "Close any open card / dialog" },
  { keys: "Enter", desc: "Save inline edit (title, list rename, etc.)" },
  { keys: "Click cover swatch", desc: "Recolour a board or card" },
  { keys: "Drag card", desc: "Move between lists or reorder" },
  { keys: "Drag list header", desc: "Reorder columns horizontally" },
];

const ROLES = [
  {
    name: "Owner",
    desc: "Full control — including deleting the board.",
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    name: "Admin",
    desc: "Manage lists, cards, labels, members.",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    name: "Member",
    desc: "Create / edit cards, comment, work checklists.",
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    name: "Viewer",
    desc: "Read-only access.",
    tone: "bg-muted text-muted-foreground",
  },
];

export default function ProjectsSettingsPage() {
  return (
    <div>
      <ProjectsTabs />

      <Card className="mb-4 border-border bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <CardContent className="flex items-center gap-4 px-5 py-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Settings className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Project settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Module-wide reference. Per-board options live on each
              board&apos;s page.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Quick links */}
        <Card className="border-border">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Quick links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <QuickLink
                href="/projects"
                icon={LayoutGrid}
                label="All boards"
              />
              <QuickLink
                href="/projects/labels"
                icon={Tag}
                label="Manage labels"
              />
              <QuickLink
                href="/projects/members"
                icon={Users}
                label="Members &amp; team"
              />
              <QuickLink
                href="/projects/archived"
                icon={Archive}
                label="Archived items"
              />
            </div>
          </CardContent>
        </Card>

        {/* Keyboard shortcuts */}
        <Card className="border-border">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <KeyboardIcon className="h-4 w-4 text-primary" />
              Keyboard shortcuts
            </h2>
            <ul className="space-y-2">
              {SHORTCUTS.map((s) => (
                <li
                  key={s.keys}
                  className="flex items-center gap-3 text-sm text-foreground"
                >
                  <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold">
                    {s.keys}
                  </kbd>
                  <span className="text-muted-foreground">{s.desc}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Roles cheat sheet */}
        <Card className="border-border lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              Board roles
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((r) => (
                <div
                  key={r.name}
                  className="rounded-2xl border border-border p-3"
                >
                  <Badge className={`rounded-full ${r.tone}`}>{r.name}</Badge>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {r.desc}
                  </p>
                </div>
              ))}
            </div>
            {/*
              Note: Badge renders as a <div>, so the wrapping element
              must NOT be a <p> (block-level inside paragraph would
              trigger a hydration error). Use a <div> with inline-flex
              wrap instead so the badges still flow with the text.
            */}
            <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              <span>Roles are scoped per board. Public boards grant implicit</span>
              <Badge variant="outline" className="rounded-full">
                Viewer
              </Badge>
              <span>to anyone in the workspace; Team boards grant</span>
              <Badge variant="outline" className="rounded-full">
                Member
              </Badge>
              <span>; Private boards require an explicit invitation.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span dangerouslySetInnerHTML={{ __html: label }} />
    </Link>
  );
}
