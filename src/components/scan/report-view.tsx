"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { removalPlan } from "@/lib/removal-letter";
import type { Finding, FindingSource, Report, Severity } from "@/types/scan";
import { External } from "./icons";
import RemovalPanel from "./removal-panel";

const ease = [0.22, 1, 0.36, 1] as const;

export const LEVEL_TEXT: Record<Report["level"], string> = {
  Low: "Low exposure",
  Moderate: "Moderate exposure",
  High: "High exposure",
  Critical: "Critical exposure",
};

export function ScoreRing({ score }: { score: number }) {
  const reduce = useReducedMotion();
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="5" />
        <m.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - score / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.4, ease, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[32px] font-medium leading-none tabular-nums">{score}</span>
        <span className="mt-1 text-[11px] text-white/45">of 100</span>
      </div>
    </div>
  );
}

function SeverityBars({ severity }: { severity: Severity }) {
  const n = severity === "high" ? 3 : severity === "medium" ? 2 : 1;
  return (
    <span className="flex h-3 items-end gap-[3px]" role="img" aria-label={`${severity} risk`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-[3px] rounded-full ${i <= n ? "bg-white" : "bg-white/15"}`} style={{ height: `${4 + i * 3}px` }} />
      ))}
    </span>
  );
}

const PREVIEW = 8;

const PRIORITY_LABEL = { now: "Do now", soon: "This week", later: "When you can" } as const;

const SOURCE_LABEL: Record<FindingSource, string> = { breach: "Breaches", profile: "Profiles", web: "Web" };

export function FindingRow({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-white/[0.07] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <SeverityBars severity={finding.severity} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-white">{finding.title}</span>
          <span className="mt-0.5 block truncate text-[12px] text-white/45">
            {finding.exposed.slice(0, 4).join(", ")}
            {finding.exposed.length > 4 ? ` and ${finding.exposed.length - 4} more` : ""}
          </span>
        </span>
        {finding.date && <span className="shrink-0 text-[12px] tabular-nums text-white/40">{finding.date}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pl-[52px]">
              <p className="whitespace-pre-line text-[13px] leading-[1.6] text-white/65">{finding.detail}</p>
              {finding.url && (
                <a
                  href={finding.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-white/80 underline-offset-4 hover:text-white hover:underline"
                >
                  Open {finding.site}
                  <External width={12} height={12} />
                </a>
              )}
              <RemovalPanel finding={finding} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function downloadPlan(findings: Finding[]) {
  const url = URL.createObjectURL(new Blob([removalPlan(findings)], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `tacet-removal-plan-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CleanUp({ findings }: { findings: Finding[] }) {
  const selfService = findings.filter((f) => f.source !== "breach" && (f.removal?.difficulty === "easy" || f.removal?.difficulty === "medium")).length;
  const breaches = findings.filter((f) => f.source === "breach").length;
  const requests = findings.length - selfService - breaches;
  const parts = [
    selfService && `${selfService} you can delete yourself with a direct link`,
    requests && `${requests} that need${requests === 1 ? "s" : ""} a request or a few manual steps`,
    breaches && `${breaches} breach${breaches > 1 ? "es" : ""} to lock down`,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-[52ch]">
        <h3 id="cleanup-heading" className="text-[15px] font-medium">
          Clean it up
        </h3>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-white/55">
          Every result below has removal steps: {parts.join(", ")}. Open one to get its deletion page and a ready-to-send GDPR or CCPA erasure request.
        </p>
      </div>
      <button
        type="button"
        onClick={() => downloadPlan(findings)}
        className="inline-flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]"
      >
        Download removal plan
      </button>
    </div>
  );
}

export function reportSections(report: Report, findings: Finding[]) {
  return [
    { id: "report-overview", label: "Overview" },
    ...(report.chain ? [{ id: "report-chain", label: "How you're found" }] : []),
    ...(report.actions.length ? [{ id: "report-actions", label: "What to do" }] : []),
    ...(findings.length ? [{ id: "report-cleanup", label: "Removal plan" }, { id: "report-findings", label: `Findings · ${findings.length}` }] : []),
  ];
}

const ANCHOR = "scroll-mt-32 lg:scroll-mt-20";

export default function ReportView({ report, findings, onClear }: { report: Report; findings: Finding[]; onClear: () => void }) {
  const [filter, setFilter] = useState<FindingSource | "all">("all");
  const [expanded, setExpanded] = useState(false);
  const counts = useMemo(() => {
    const c: Record<FindingSource, number> = { breach: 0, profile: 0, web: 0 };
    for (const f of findings) c[f.source] += 1;
    return c;
  }, [findings]);
  const filtered = filter === "all" ? findings : findings.filter((f) => f.source === filter);
  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const sections = (Object.keys(counts) as FindingSource[]).filter((s) => counts[s] > 0);

  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease, delay: 0.1 + i * 0.08 },
  });

  return (
    <div className="space-y-4">
      <m.section {...reveal(0)} id="report-overview" className={`rounded-2xl border border-white/12 p-6 sm:p-7 ${ANCHOR}`} aria-labelledby="report-title">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="lg:hidden">
            <ScoreRing score={report.score} />
          </div>
          <div>
            <h2 id="report-title" className="font-display text-[26px] font-medium leading-tight">
              {LEVEL_TEXT[report.level]}
            </h2>
            <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-white/65">{report.summary}</p>
          </div>
        </div>
      </m.section>

      {report.chain && (
        <m.section {...reveal(1)} id="report-chain" className={`rounded-2xl border border-white/12 p-6 sm:p-7 ${ANCHOR}`} aria-labelledby="chain-heading">
          <h3 id="chain-heading" className="text-[15px] font-medium">
            How someone could find you
          </h3>
          <ol className="relative mt-5">
            <span aria-hidden="true" className="absolute bottom-3 left-[11px] top-3 w-px bg-white/15" />
            {report.chain.links.map((link, i) => (
              <m.li
                key={`${link.label}-${i}`}
                className="relative flex items-start gap-4 py-2.5"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease, delay: 0.35 + i * 0.12 }}
              >
                <span className="relative z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border border-white/30 bg-black text-[11px] tabular-nums text-white/80">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-white/45">{link.label}</span>
                  <span className="mt-0.5 block break-words font-mono text-[14px] text-white">{link.value}</span>
                </span>
              </m.li>
            ))}
          </ol>
          {report.chain.breakAt && (
            <div className="mt-4 rounded-xl bg-white p-4 text-black">
              <p className="text-[13px] text-black/55">Break the chain</p>
              <p className="mt-1 text-[15px] leading-[1.5]">{report.chain.breakAt}</p>
            </div>
          )}
        </m.section>
      )}

      {report.actions.length > 0 && (
        <m.section {...reveal(2)} id="report-actions" className={`rounded-2xl border border-white/12 ${ANCHOR}`} aria-labelledby="actions-heading">
          <h3 id="actions-heading" className="px-6 pt-6 text-[15px] font-medium sm:px-7">
            What to do
          </h3>
          <ol className="mt-3">
            {report.actions.map((action, i) => (
              <li key={i} className="flex flex-col gap-2 border-t border-white/[0.07] px-6 py-4 first:border-0 sm:flex-row sm:gap-6 sm:px-7">
                <span
                  className={`h-fit w-fit shrink-0 rounded-full px-2.5 py-0.5 text-[12px] sm:mt-0.5 sm:w-24 sm:text-center ${
                    action.priority === "now" ? "bg-white text-black" : action.priority === "soon" ? "border border-white/30 text-white/80" : "text-white/45"
                  }`}
                >
                  {PRIORITY_LABEL[action.priority]}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] text-white">{action.title}</p>
                  <p className="mt-1 text-[14px] leading-[1.6] text-white/55">{action.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </m.section>
      )}

      {findings.length > 0 && (
        <m.section {...reveal(3)} id="report-cleanup" className={`rounded-2xl border border-white/12 p-6 sm:p-7 ${ANCHOR}`} aria-labelledby="cleanup-heading">
          <CleanUp findings={findings} />
        </m.section>
      )}

      {findings.length > 0 && (
        <m.section {...reveal(4)} id="report-findings" className={`overflow-hidden rounded-2xl border border-white/12 ${ANCHOR}`} aria-labelledby="findings-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
            <h3 id="findings-heading" className="text-[15px] font-medium">
              Everything we found
            </h3>
            {sections.length > 1 && (
              <div role="tablist" aria-label="Filter findings" className="flex gap-1 rounded-full border border-white/12 p-1">
                {(["all", ...sections] as const).map((key) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={filter === key}
                    onClick={() => {
                      setFilter(key);
                      setExpanded(false);
                    }}
                    className={`relative rounded-full px-3 py-1 text-[12px] transition-colors ${filter === key ? "text-black" : "text-white/55 hover:text-white"}`}
                  >
                    {filter === key && (
                      <m.span layoutId="finding-filter" className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.3, ease }} />
                    )}
                    <span className="relative">
                      {key === "all" ? `All ${findings.length}` : `${SOURCE_LABEL[key]} ${counts[key]}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="border-t border-white/[0.07]">
            {visible.map((f) => (
              <FindingRow key={f.id} finding={f} />
            ))}
          </ul>
          {filtered.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full border-t border-white/[0.07] px-5 py-3.5 text-[13px] text-white/60 transition-colors hover:bg-white/[0.03] hover:text-white"
            >
              {expanded ? "Show fewer" : `Show all ${filtered.length}`}
            </button>
          )}
        </m.section>
      )}

      <m.div {...reveal(5)} className="flex flex-wrap items-center justify-between gap-4 px-1 pt-2">
        <p className="text-[12px] text-white/35">
          {report.analyzedBy === "gemini" ? "Analysis by Gemini." : report.analyzedBy === "claude" ? "Analysis by Claude." : "Ranked by Tacet rules."} Results are not stored. Closing this page deletes them, so download your removal plan first.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Clear and start over
        </button>
      </m.div>
    </div>
  );
}
