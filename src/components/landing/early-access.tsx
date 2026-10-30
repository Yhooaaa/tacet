"use client";

import { useState, type FormEvent } from "react";
import { EARLY_ACCESS_DISCOUNT, EARLY_PRICE_LABEL, PRO_FEATURES, PRO_PRICE_LABEL } from "@/lib/pricing";
import { api } from "@/lib/api";

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="mt-[3px] shrink-0">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Place = "scan" | "dashboard" | "pricing";

export function ReserveForm({ via, signedIn = false, email: initial = "", tone = "light" }: { via: Place; signedIn?: boolean; email?: string; tone?: "light" | "dark" }) {
  const [email, setEmail] = useState(initial);
  const [state, setState] = useState<{ status: "idle" | "busy" | "done"; error?: string; email?: string }>({ status: "idle" });
  const dark = tone === "dark";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ status: "busy" });
    try {
      const res = await api<{ email: string }>("/api/waitlist", { method: "POST", body: { email, via } });
      setState({ status: "done", email: res.email });
    } catch (error) {
      setState({ status: "idle", error: (error as Error).message });
    }
  };

  if (state.status === "done") {
    return (
      <p role="status" className={`text-[14px] leading-[1.6] ${dark ? "text-white/80" : "text-black/75"}`}>
        Reserved. We&rsquo;ll write to <span className="font-medium">{state.email}</span> when Pro opens, and you&rsquo;ll pay {EARLY_PRICE_LABEL}/month instead of {PRO_PRICE_LABEL}. Nothing is charged until you choose to subscribe.
      </p>
    );
  }

  const button = `inline-flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-[14px] font-medium transition-[background-color,transform] active:scale-[0.98] disabled:opacity-60 ${
    dark ? "bg-white text-black hover:bg-white/85" : "bg-black text-white hover:bg-black/80"
  }`;

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        {!signedIn && (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Your email"
            autoComplete="email"
            className={`h-11 min-w-0 shrink-0 rounded-full sm:flex-1 sm:shrink border px-4 text-[14px] outline-none transition-colors ${
              dark ? "border-white/20 bg-transparent text-white placeholder:text-white/35 focus:border-white/60" : "border-black/15 bg-white text-black placeholder:text-black/35 focus:border-black/50"
            }`}
          />
        )}
        <button type="submit" disabled={state.status === "busy"} className={button}>
          {state.status === "busy" ? "Reserving…" : `Reserve Pro for ${EARLY_PRICE_LABEL}/month`}
        </button>
      </div>
      {state.error && (
        <p role="alert" className={`mt-2 text-[13px] ${dark ? "text-white" : "text-black"}`}>
          {state.error}
        </p>
      )}
      <p className={`mt-3 text-[13px] leading-[1.5] ${dark ? "text-white/50" : "text-black/50"}`}>
        No payment now. {PRO_PRICE_LABEL}/month after launch, {EARLY_ACCESS_DISCOUNT}% off for everyone who reserves before it.
      </p>
    </form>
  );
}

export default function EarlyAccess({
  lead = "This was the free scan. Tacet Pro goes further.",
  via,
  signedIn,
  email,
}: {
  lead?: string;
  via: Place;
  signedIn?: boolean;
  email?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 text-black sm:p-7">
      <p className="w-fit rounded-full bg-black px-2.5 py-0.5 text-[12px] font-medium text-white">
        Before launch: {EARLY_ACCESS_DISCOUNT}% off
      </p>
      <p className="mt-4 text-[17px] font-medium">Want the deep scan, removal and monitoring?</p>
      <p className="mt-1.5 max-w-[52ch] text-[14px] leading-[1.6] text-black/60">{lead}</p>
      <ul className="mt-4 space-y-2 text-[14px] leading-[1.5] text-black/80">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <ReserveForm via={via} signedIn={signedIn} email={email} />
      </div>
    </div>
  );
}
