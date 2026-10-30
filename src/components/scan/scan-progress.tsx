"use client";

import { useState } from "react";
import { m } from "motion/react";
import type { StepId, StepStatus } from "@/types/scan";
import { Alert, Check, Minus, Spinner } from "./icons";

export type StepState = { label: string; status: StepStatus; note?: string; count?: number };

export type QueueState = { position: number; etaSeconds: number };

function waitLabel(seconds: number) {
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

const STEP_ORDER: StepId[] = ["breaches", "profiles", "web", "browser", "analysis"];

const PENDING_LABEL: Record<StepId, string> = {
  breaches: "Data breaches",
  profiles: "Public profiles",
  web: "Open web",
  browser: "Browser agent",
  analysis: "Analysis",
};

function StatusIcon({ status }: { status?: StepStatus }) {
  if (status === "running") return <Spinner className="text-white" />;
  if (status === "done")
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
        <Check width={10} height={10} strokeWidth={2} />
      </span>
    );
  if (status === "skipped") return <Minus className="text-white/35" />;
  if (status === "error") return <Alert className="text-white" />;
  return <span className="block h-1.5 w-1.5 rounded-full bg-white/25" />;
}

export default function ScanProgress({
  steps,
  findings,
  finished,
  queue,
  collapsible = false,
  stopped = false,
}: {
  steps: Partial<Record<StepId, StepState>>;
  findings: number;
  finished: boolean;
  queue?: QueueState;
  collapsible?: boolean;
  stopped?: boolean;
}) {
  const waiting = queue && !finished ? queue : null;
  const [open, setOpen] = useState(false);
  const folded = collapsible && finished && !open;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/12">
      <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="text-[15px] font-medium text-white">{stopped ? "Scan stopped" : finished ? "Scan complete" : waiting ? "Waiting for a free slot" : "Scanning"}</p>
        <p className="text-[13px] tabular-nums text-white/55">
          {waiting ? `#${waiting.position} in line` : `${findings} finding${findings === 1 ? "" : "s"}`}
        </p>
        {!finished && (
          <m.span
            aria-hidden="true"
            className="absolute bottom-[-1px] left-0 h-px w-1/3 bg-linear-to-r from-transparent via-white to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
          />
        )}
      </div>
      {waiting && (
        <p className="border-b border-white/10 px-5 py-3.5 text-[13px] leading-[1.6] text-white/55" aria-live="polite">
          Lots of people are scanning right now. Keep this page open and your scan starts on its own, in {waitLabel(waiting.etaSeconds)}.
        </p>
      )}
      {collapsible && finished && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full px-5 py-3 text-left text-[13px] text-white/55 transition-colors hover:text-white"
        >
          {open ? "Hide sources" : "Show sources"}
        </button>
      )}
      <ul className={`divide-y divide-white/[0.07] ${folded ? "hidden" : collapsible && finished ? "border-t border-white/10" : ""}`} aria-live="polite">
        {STEP_ORDER.map((id) => {
          const step = steps[id];
          const quiet = !step || step.status === "skipped";
          return (
            <li key={id} className="flex items-start gap-4 px-5 py-3.5">
              <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center">
                <StatusIcon status={step?.status} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] ${quiet ? "text-white/45" : "text-white"}`}>{step?.label ?? PENDING_LABEL[id]}</p>
                {step?.note && <p className="mt-0.5 text-[13px] text-white/45">{step.note}</p>}
              </div>
              {typeof step?.count === "number" && step.status === "done" && (
                <span className="font-mono text-[13px] tabular-nums text-white/70">{step.count}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
