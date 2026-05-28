/**
 * Layout for the Roles routes (/roles/*).
 */
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function RolesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
