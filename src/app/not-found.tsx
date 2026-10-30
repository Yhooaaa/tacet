import type { Metadata } from "next";
import Link from "next/link";
import AppHeader from "@/components/layout/app-header";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="on-dark flex min-h-dvh flex-col bg-black text-white">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-5 pb-[12vh]">
        <p className="font-mono text-[13px] text-white/45">404</p>
        <h1 className="font-display mt-3 text-[40px] font-medium leading-[1.05] sm:text-[56px]">Nothing here.</h1>
        <p className="mt-4 max-w-[30rem] text-[16px] leading-[1.6] text-white/55">
          This page doesn&rsquo;t exist, or it moved. Your footprint, on the other hand, is still out there.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/scan"
            className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]"
          >
            Start free scan
          </Link>
          <Link href="/" className="inline-flex h-11 items-center rounded-full border border-white/20 px-5 text-[14px] text-white/80 transition-colors hover:border-white/50 hover:text-white">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
