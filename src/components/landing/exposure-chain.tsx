"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useInView, useReducedMotion } from "motion/react";

type Link = {
  label: string;
  value: string;
  source: string;
  reveals: string;
};

const CHAIN: Link[] = [
  {
    label: "Username",
    value: "nightowl_92",
    source: "Public Reddit account",
    reveals: "Posts mention a city and an employer.",
  },
  {
    label: "Developer profile",
    value: "github.com/nightowl_92",
    source: "Same username on GitHub",
    reveals: "Commit history shows a personal email address.",
  },
  {
    label: "Email",
    value: "m.kowalski@gmail.com",
    source: "Git commit metadata",
    reveals: "The address appears in a 2021 forum breach.",
  },
  {
    label: "Breach record",
    value: "Full name, date of birth, city",
    source: "Forum breach, 2021",
    reveals: "Enough to connect the username to a real person.",
  },
  {
    label: "You",
    value: "Marta Kowalski, Kraków",
    source: "Identified in four steps",
    reveals: "Hide the commit email on GitHub and the chain breaks at step two.",
  },
];

const STEP_MS = 2600;
const ease = [0.22, 1, 0.36, 1] as const;

export default function ExposureChain() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused || reduce) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % CHAIN.length), active === CHAIN.length - 1 ? STEP_MS * 1.8 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [active, inView, paused, reduce]);

  const current = CHAIN[active];
  const last = active === CHAIN.length - 1;

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        ref={ref}
        className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <ol className="relative" aria-label="Exposure chain">
          <span aria-hidden="true" className="absolute bottom-6 left-[11px] top-6 w-px bg-mist" />
          <m.span
            aria-hidden="true"
            className="absolute left-[11px] top-6 w-px origin-top bg-ink"
            style={{ height: "calc(100% - 48px)" }}
            initial={false}
            animate={{ scaleY: active / (CHAIN.length - 1) }}
            transition={{ duration: reduce ? 0 : 0.7, ease }}
          />
          {CHAIN.map((step, i) => {
            const reached = i <= active;
            return (
              <li key={step.label}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={i === active ? "step" : undefined}
                  className="group relative flex w-full items-start gap-5 rounded-md py-3 text-left"
                >
                  <span
                    className={`relative z-10 mt-[3px] flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums transition-colors duration-500 ${
                      reached ? "border-ink bg-ink text-paper" : "border-mist bg-paper text-slate group-hover:border-slate"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-[15px] font-medium transition-colors duration-500 ${
                        reached ? "text-ink" : "text-slate group-hover:text-steel"
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[13px] text-steel">{step.value}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="relative min-h-[300px] overflow-hidden rounded-xl bg-black p-7 text-white md:p-10" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={active}
              initial={{ opacity: 0, y: reduce ? 0 : 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: reduce ? 0 : -10, filter: "blur(4px)" }}
              transition={{ duration: 0.45, ease }}
              className="flex h-full flex-col"
            >
              <p className="text-[13px] text-white/45">
                Step {active + 1} of {CHAIN.length}
              </p>
              <p className="font-display mt-5 break-words text-[26px] font-medium leading-[1.15] sm:text-[32px]">
                {current.value}
              </p>
              <p className="mt-3 text-[15px] text-white/55">{current.source}</p>

              <div className="mt-auto pt-10">
                <div className={`rounded-lg border p-4 ${last ? "border-white/40 bg-white text-black" : "border-white/15"}`}>
                  <p className={`text-[13px] ${last ? "text-black/55" : "text-white/45"}`}>
                    {last ? "How Tacet breaks the chain" : "What this reveals"}
                  </p>
                  <p className="mt-1 text-[16px] leading-[1.5]">{current.reveals}</p>
                </div>
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </LazyMotion>
  );
}
