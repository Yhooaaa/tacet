import type { Metadata } from "next";
import { Suspense } from "react";
import AppHeader from "@/components/layout/app-header";
import SignIn from "@/components/account/sign-in";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <main className="on-dark flex min-h-dvh flex-col bg-black text-white">
      <AppHeader />
      <Suspense fallback={null}>
        <SignIn />
      </Suspense>
    </main>
  );
}
