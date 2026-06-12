import { DashboardShell } from "@/components/layout/DashboardShell";

export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
