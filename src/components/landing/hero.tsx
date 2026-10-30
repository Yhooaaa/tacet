import Link from "next/link";
import type { CSSProperties } from "react";
import GlobeLoader from "./globe-loader";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default function Hero() {
  return (
    <section className="on-dark relative isolate overflow-hidden bg-black text-white">
      <div
        aria-hidden="true"
        className="globe-in pointer-events-none absolute left-1/2 top-[56%] w-[150vw] max-w-[1100px] -translate-x-1/2 md:left-auto md:right-[-14%] md:top-1/2 md:w-[78vw] md:translate-x-0 md:-translate-y-1/2 lg:right-[-8%]"
      >
        <div className="pointer-events-auto">
          <GlobeLoader />
        </div>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black to-transparent" />

      <div className="pointer-events-none relative mx-auto flex min-h-[100svh] max-w-[1200px] flex-col px-5 pb-[52vh] pt-32 md:justify-center md:px-8 md:pb-24 md:pt-28">
        <div className="pointer-events-auto max-w-[620px]">
          <h1 className="font-display text-[44px] font-medium leading-[0.98] sm:text-[60px] lg:text-[80px]">
            <span className="rise block" style={delay(80)}>
              You&rsquo;re louder
            </span>{" "}
            <span className="rise block" style={delay(180)}>
              than you think.
            </span>
          </h1>

          <p className="rise mt-7 max-w-[30rem] text-[17px] leading-[1.6] text-white/65 sm:text-[19px]" style={delay(320)}>
            Tacet scans data breaches, the open web, web archives and 7,000+ sites for your email, phone number and usernames.
            Then it shows you how to go quiet.
          </p>

          <div className="rise mt-10 flex flex-col gap-3 sm:flex-row" style={delay(440)}>
            <Link
              href="/scan"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-[15px] font-medium text-black transition-[background-color,transform] duration-200 hover:bg-white/85 active:scale-[0.98]"
            >
              Start free scan
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-[15px] font-medium text-white transition-[border-color,background-color,transform] duration-200 hover:border-white/60 hover:bg-white/5 active:scale-[0.98]"
            >
              See how it works
            </Link>
          </div>

          <p className="rise mt-6 text-[13px] text-white/45" style={delay(540)}>
            Your first scan is free. Emails and phone numbers are verified before they&apos;re scanned.
          </p>
        </div>
      </div>
    </section>
  );
}
