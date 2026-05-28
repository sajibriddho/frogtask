"use client";

/**
 * MasterBreadcrumb – Renders clickable breadcrumb for dashboard and master routes.
 * Format: Master Data / Core Data / Locations (each segment clickable except current).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getBreadcrumbSegments } from "@/lib/breadcrumb";

export function MasterBreadcrumb() {
  const pathname = usePathname() ?? "";
  const segments = getBreadcrumbSegments(pathname);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((seg, i) => (
          <span key={i} className="contents">
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {seg.href != null ? (
                <BreadcrumbLink asChild>
                  <Link href={seg.href}>{seg.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{seg.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
