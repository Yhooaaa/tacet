"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { identifierKey, KIND_LABEL, maskIdentifier, type Identifier } from "@/lib/identifiers";
import { BROKERS } from "@/lib/brokers";
import { phoneInfo } from "@/lib/phone";
import { EARLY_ACCESS_DISCOUNT, EARLY_PRICE_LABEL } from "@/lib/pricing";
import { api, holdProofs, RequestError } from "@/lib/api";
import type { Finding, Report, StepId } from "@/types/scan";
import EarlyAccess from "@/components/landing/early-access";
import { Spinner } from "./icons";
import ReportView, { FindingRow, LEVEL_TEXT, reportSections, ScoreRing } from "./report-view";
import ScanProgress, { type QueueState, type StepState } from "./scan-progress";

const ease = [0.22, 1, 0.36, 1] as const;

type ScanRun = { steps: Partial<Record<StepId, StepState>>; findings: Finding[]; report?: Report; finished: boolean; queue?: QueueState };

function MonitorCta({ proofs }: { proofs: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function monitor() {
    setBusy(true);
    try {
      await api("/api/account/identifiers", { method: "POST", body: { proofs } });
      router.push("/dashboard");
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) {
        holdProofs(proofs);
        router.push("/signin?next=/dashboard");
      } else setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 text-black sm:p-7">
      <p className="text-[17px] font-medium">Keep watching these details</p>
      <p className="mt-1.5 max-w-[52ch] text-[14px] leading-[1.6] text-black/60">
        Get an email when they turn up in a new breach, and work through removing yourself from {BROKERS.length} data brokers.
      </p>
      <button
        type="button"
        onClick={monitor}
        disabled={busy}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-black px-5 text-[14px] font-medium text-white transition-[background-color,transform] hover:bg-black/80 active:scale-[0.98] disabled:opacity-60"
      >
        {busy && <Spinner />}
        Monitor them in your dashboard
      </button>
    </div>
  );
}

function useActiveSection(ids: string[]) {
  const key = ids.join(" ");
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = key
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [key]);
  return active ?? ids[0];
}

function useJump() {
  const reduce = useReducedMotion();
  return (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
}

function Details({ identifiers }: { identifiers: Identifier[] }) {
  return (
    <div>
      <p className="text-[12px] text-white/45">Scanning {identifiers.length === 1 ? "one detail" : `${identifiers.length} details`}</p>
      <ul className="mt-2.5 flex flex-wrap gap-2 lg:flex-col lg:gap-1.5">
        {identifiers.map((id) => (
          <li key={identifierKey(id)} className="min-w-0 rounded-full border border-white/12 px-3 py-1 lg:rounded-lg lg:px-3 lg:py-2">
            <span className="hidden text-[11px] text-white/40 lg:block">{KIND_LABEL[id.kind]}</span>
            <span className="block truncate font-mono text-[12px] text-white/80 lg:text-[13px]">{id.kind === "username" ? id.value : maskIdentifier(id)}</span>
            {id.kind === "phone" && phoneInfo(id.value) && <span className="hidden text-[11px] text-white/40 lg:block">{phoneInfo(id.value)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveFindings({ run }: { run: ScanRun }) {
  const LIMIT = 40;
  const latest = [...run.findings].reverse().slice(0, LIMIT);
  return (
    <section aria-labelledby="live-heading" className="overflow-hidden rounded-2xl border border-white/12">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="live-heading" className="text-[15px] font-medium">
          {run.queue ? "Your scan is in line" : "Found so far"}
        </h2>
        {!run.queue && <span className="text-[13px] tabular-nums text-white/50">{run.findings.length}</span>}
      </div>
      {latest.length ? (
        <ul className="border-t border-white/[0.07]" aria-live="polite">
          {latest.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-white/[0.07] px-5 py-10 text-center text-[14px] leading-[1.6] text-white/45">
          {run.queue ? "It starts on its own as soon as a slot frees up. Keep this page open." : "Results appear here as each source answers."}
        </p>
      )}
      {run.findings.length > LIMIT && (
        <p className="border-t border-white/[0.07] px-5 py-3.5 text-[13px] text-white/45">and {run.findings.length - LIMIT} more, all in the report when the scan finishes</p>
      )}
    </section>
  );
}

export default function ScanWorkspace({
  run,
  proofs,
  details,
  notices,
  onRetry,
  onClear,
}: {
  run: ScanRun;
  proofs: { identifier: Identifier; proof: string }[];
  details: Identifier[];
  notices: { id: string; text: string }[];
  onRetry: () => void;
  onClear: () => void;
}) {
  const { report } = run;
  const sections = report ? reportSections(report, run.findings) : [];
  const navItems = report ? [...sections, { id: "report-pro", label: report.deep ? "Monitoring" : "Tacet Pro" }] : [];
  const active = useActiveSection(navItems.map((s) => s.id));
  const jump = useJump();
  const failed = run.finished && !report;
  const barRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const link = bar?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!bar || !link) return;
    bar.scrollTo({ left: link.offsetLeft - bar.clientWidth / 2 + link.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
      className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-6 md:px-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10 lg:pt-10"
    >
      <aside className="flex flex-col gap-5 lg:sticky lg:top-[88px] lg:max-h-[calc(100dvh-104px)] lg:self-start lg:overflow-y-auto lg:pb-4">
        <Details identifiers={details} />

        <ScanProgress
          steps={run.steps}
          findings={run.findings.length}
          finished={run.finished || Boolean(report)}
          queue={run.queue}
          collapsible={Boolean(report)}
          stopped={failed}
        />

        {report && (
          <div className="hidden items-center gap-4 rounded-2xl border border-white/12 p-5 lg:order-first lg:flex">
            <ScoreRing score={report.score} />
            <div className="min-w-0">
              <p className="text-[12px] text-white/45">Exposure score</p>
              <p className="font-display mt-1 text-[19px] font-medium leading-tight">{LEVEL_TEXT[report.level]}</p>
            </div>
          </div>
        )}

        {report && (
          <nav aria-label="Report sections" className="hidden lg:order-first lg:block">
            <ul className="space-y-0.5">
              {navItems.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => jump(e, s.id)}
                    aria-current={active === s.id ? "location" : undefined}
                    className={`relative block rounded-lg px-3 py-1.5 text-[14px] transition-colors ${active === s.id ? "text-white" : "text-white/50 hover:text-white"}`}
                  >
                    {active === s.id && <m.span layoutId="report-nav" className="absolute inset-0 rounded-lg bg-white/[0.07]" transition={{ duration: 0.3, ease }} />}
                    <span className="relative">{s.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {report && !report.deep && (
          <a
            href="#report-pro"
            onClick={(e) => jump(e, "report-pro")}
            className="hidden rounded-2xl bg-white p-5 text-black transition-transform active:scale-[0.99] lg:order-first lg:block"
          >
            <span className="block text-[12px] text-black/50">Before launch: {EARLY_ACCESS_DISCOUNT}% off</span>
            <span className="mt-1 block text-[15px] font-medium">Reserve Tacet Pro for {EARLY_PRICE_LABEL}/month</span>
            <span className="mt-1 block text-[13px] leading-[1.5] text-black/55">Deep scan, data removal and monitoring.</span>
          </a>
        )}

        {run.finished && (
          <button type="button" onClick={onClear} className="hidden self-start px-3 text-[13px] text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline lg:block">
            Start a new scan
          </button>
        )}
      </aside>

      <div className="mt-6 min-w-0 lg:mt-0">
        {report && (
          <nav aria-label="Report sections" className="sticky top-14 z-30 -mx-5 mb-4 border-b border-white/[0.06] bg-black/85 px-5 backdrop-blur-xl lg:hidden">
            <ul ref={barRef} className="relative -mb-px flex gap-5 overflow-x-auto py-3 text-[13px] [scrollbar-width:none]">
              {navItems.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => jump(e, s.id)}
                    aria-current={active === s.id ? "location" : undefined}
                    className={active === s.id ? "text-white" : "text-white/50"}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {notices.map((n) => (
          <p key={n.id} role="alert" className="mb-4 rounded-xl border border-white/20 px-4 py-3 text-[14px] leading-[1.6] text-white">
            {n.text}
          </p>
        ))}

        {failed ? (
          <div className="rounded-2xl border border-white/12 p-6 sm:p-7">
            <p className="text-[15px] font-medium">The scan didn&rsquo;t finish</p>
            <p className="mt-1.5 text-[14px] leading-[1.6] text-white/55">Your details are still verified, so you can run it again straight away.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={onRetry} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]">
                Run the scan again
              </button>
              <button type="button" onClick={onClear} className="inline-flex h-11 items-center rounded-full border border-white/20 px-5 text-[14px] text-white/80 transition-colors hover:border-white/50 hover:text-white">
                Start over
              </button>
            </div>
          </div>
        ) : report ? (
          <div className="space-y-4">
            <ReportView report={report} findings={run.findings} onClear={onClear} />
            <m.div
              id="report-pro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease, delay: 0.6 }}
              className="scroll-mt-32 pt-4 lg:scroll-mt-20"
            >
              {report.deep ? (
                proofs.length > 0 && <MonitorCta proofs={proofs.map((p) => p.proof)} />
              ) : (
                <EarlyAccess via="scan" email={proofs.find((p) => p.identifier.kind === "email")?.identifier.value} />
              )}
            </m.div>
          </div>
        ) : (
          <LiveFindings run={run} />
        )}
      </div>
    </m.div>
  );
}
