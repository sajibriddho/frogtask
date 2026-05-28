/**
 * Layout for Procurement & Production routes (/procurement-and-production/*).
 * Wraps children in DashboardShell (sidebar + topbar).
 */
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
