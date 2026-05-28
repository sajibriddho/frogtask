/**
 * Layout for Settings route (/settings).
 * All system settings are monitored from the single Settings page.
 */
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
