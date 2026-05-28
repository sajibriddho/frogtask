import { DashboardShell } from "@/components/layout/DashboardShell";

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
