import { DashboardShell } from "@/components/layout/DashboardShell";

export default function TodayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
