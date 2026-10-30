"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { DIFFICULTY_LABEL, LAW_LABEL, mailtoLink, removalLetter, type Law } from "@/lib/removal-letter";
import type { Finding } from "@/types/scan";
import { Check, Copy, External } from "./icons";

const ease = [0.22, 1, 0.36, 1] as const;

function Letter({ finding }: { finding: Finding }) {
  const [law, setLaw] = useState<Law>("gdpr");
  const [copied, setCopied] = useState(false);
  const letter = removalLetter(finding, law);
  const to = finding.removal?.email;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${letter.subject}\n\n${letter.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Privacy law" className="flex gap-1 rounded-full border border-white/12 p-1">
          {(Object.keys(LAW_LABEL) as Law[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={law === key}
              onClick={() => setLaw(key)}
              className={`rounded-full px-3 py-1 text-[12px] transition-colors ${law === key ? "bg-white text-black" : "text-white/55 hover:text-white"}`}
            >
              {LAW_LABEL[key]}
            </button>
          ))}
        </div>
        {to && <span className="text-[12px] text-white/45">To: {to}</span>}
      </div>
      <p className="mt-3 text-[12px] text-white/45">Subject: {letter.subject}</p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.6] text-white/75">{letter.body}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-[13px] text-white/80 transition-colors hover:border-white/50 hover:text-white"
        >
          {copied ? <Check width={13} height={13} /> : <Copy width={13} height={13} />}
          {copied ? "Copied" : "Copy letter"}
        </button>
        <a
          href={mailtoLink(to, letter)}
          className="inline-flex h-9 items-center rounded-full border border-white/20 px-3.5 text-[13px] text-white/80 transition-colors hover:border-white/50 hover:text-white"
        >
          Open in my email app
        </a>
      </div>
      <p className="mt-3 text-[12px] leading-[1.5] text-white/40">
        Send it from your own inbox and add your name. {to ? "" : "Look for a privacy or support address on the site. "}Keep the reply as proof.
      </p>
    </div>
  );
}

export default function RemovalPanel({ finding }: { finding: Finding }) {
  const [writing, setWriting] = useState(false);
  const removal = finding.removal;
  if (!removal) return null;

  return (
    <div className="mt-5 border-t border-white/[0.07] pt-4">
      <div className="flex items-center gap-2.5">
        <p className="text-[13px] font-medium text-white">How to remove it</p>
        {removal.difficulty && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              removal.difficulty === "easy" ? "bg-white text-black" : removal.difficulty === "medium" ? "border border-white/30 text-white/75" : "border border-dashed border-white/30 text-white/60"
            }`}
          >
            {DIFFICULTY_LABEL[removal.difficulty]}
          </span>
        )}
      </div>
      <ol className="mt-3 space-y-2">
        {removal.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-[1.55] text-white/65">
            <span className="w-3 shrink-0 text-right tabular-nums text-white/35">{i + 1}</span>
            <span className="min-w-0 break-words">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {removal.url && (
          <a
            href={removal.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]"
          >
            {removal.urlLabel ?? "Open removal page"}
            <External width={12} height={12} />
          </a>
        )}
        {removal.letter && (
          <button
            type="button"
            onClick={() => setWriting((v) => !v)}
            aria-expanded={writing}
            className="inline-flex h-9 items-center rounded-full border border-white/20 px-3.5 text-[13px] text-white/80 transition-colors hover:border-white/50 hover:text-white"
          >
            {writing ? "Hide the request" : "Write an erasure request"}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {writing && (
          <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
            <Letter finding={finding} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
