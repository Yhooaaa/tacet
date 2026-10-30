import type { Metadata } from "next";
import AppHeader from "@/components/layout/app-header";
import Dashboard from "@/components/account/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <main className="on-dark flex min-h-dvh flex-col bg-black text-white">
      <AppHeader />
      <Dashboard />
    </main>
  );
}
