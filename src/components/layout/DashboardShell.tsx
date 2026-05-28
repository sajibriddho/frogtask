"use client";

/**
 * DashboardShell — chrome for the authenticated app.
 *
 * Single sticky TopNav above the content area, plus a slim footer. The
 * old sidebar lives in TopNav now (productivity tabs as primary nav,
 * admin items in the user dropdown).
 */

import * as React from "react";
import { TopNav } from "@/components/layout/TopNav";
import { useBranding } from "@/hooks/useBranding";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { companyName } = useBranding();
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-(--breakpoint-2xl) px-3 sm:px-6 py-4 sm:py-6 pb-20 sm:pb-16 max-w-full overflow-x-hidden">
        {children}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 h-12 border-t border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
        <div className="flex h-full items-center justify-center px-4 sm:px-6">
          <p
            className="text-xs text-muted-foreground truncate max-w-full"
            title={`© ${currentYear} ${companyName}. All rights reserved.`}
          >
            &copy; {currentYear}{" "}
            <span className="font-medium text-foreground">{companyName}</span>.
            All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
