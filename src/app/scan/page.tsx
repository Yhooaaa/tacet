import type { Metadata } from "next";
import AppHeader from "@/components/layout/app-header";
import ScanApp from "@/components/scan/scan-app";

export const metadata: Metadata = {
  title: "Scan",
  description: "Verify your email or phone number, add your usernames and see where they're exposed online.",
};

export default function ScanPage() {
  return (
    <main className="on-dark flex min-h-dvh flex-col bg-black text-white">
      <AppHeader />
      <ScanApp />
    </main>
  );
}
