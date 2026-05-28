/**
 * Layout for the Users routes (/users/*).
 */
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
