"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { maskIdentifier, type Identifier } from "@/lib/identifiers";
import { checkTelegram, confirmVerification } from "@/lib/api";
import { Check, Copy, External, Spinner } from "./icons";

export type Challenge = {
  identifier: Identifier;
  token: string;
  method: "email" | "sms" | "bio" | "telegram";
  code?: string;
  link?: string;
  devCode?: string;
  note?: string;
  dev?: boolean;
};

type Props = {
  challenge: Challenge;
  verified: boolean;
  onVerified: (proof: string) => void;
  onResend: () => Promise<void>;
};

export default function VerifyCard({ challenge, verified, onVerified, onResend }: Props) {
  const { identifier, method } = challenge;
  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait" initial={false}>
        {verified ? (
          <m.p
            key="done"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-[15px] text-white"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
              <Check width={12} height={12} />
            </span>
            Verified {method === "bio" ? identifier.value : maskIdentifier(identifier)}
          </m.p>
        ) : (
          <m.div key="pending" exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {method === "bio" ? (
              <BioCheck challenge={challenge} onVerified={onVerified} />
            ) : method === "telegram" ? (
              <TelegramCheck challenge={challenge} onVerified={onVerified} onResend={onResend} />
            ) : (
              <CodeEntry challenge={challenge} onVerified={onVerified} onResend={onResend} />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DevNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-white/20 px-3 py-2 text-[13px] text-white/55">
      <span className="font-medium text-white/80">Dev mode.</span> {children}
    </p>
  );
}

const confirmForProof = (token: string, code: string) => confirmVerification(token, code).then((r) => r.proof);

export function CodeEntry({
  challenge,
  onVerified,
  onResend,
  confirm = confirmForProof,
  purpose = "Enter it to confirm this is yours.",
}: Omit<Props, "verified"> & { confirm?: (token: string, code: string) => Promise<string>; purpose?: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTried = useRef("");

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [challenge.token]);

  useEffect(() => {
    if (code.length !== 6 || busy || lastTried.current === code) return;
    lastTried.current = code;
    setBusy(true);
    setError(null);
    confirm(challenge.token, code)
      .then(onVerified)
      .catch((e: Error) => {
        setError(e.message);
        setBusy(false);
      });
  }, [code, busy, challenge.token, onVerified, confirm]);

  const where = challenge.method === "email" ? "email" : "text message";

  return (
    <div>
      <p className="text-[15px] leading-[1.6] text-white/80">
        We sent a 6-digit code by {where} to <span className="text-white">{maskIdentifier(challenge.identifier)}</span>. {purpose}
      </p>
      {challenge.note && <p className="mt-1 text-[13px] text-white/45">{challenge.note}</p>}

      <div className="group relative mt-5 w-fit">
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError(null);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          aria-label="Verification code"
          aria-invalid={Boolean(error)}
          disabled={busy}
          className="absolute inset-0 z-10 w-full cursor-text opacity-0"
        />
        <div aria-hidden="true" className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => {
            const filled = i < code.length;
            const active = i === Math.min(code.length, 5) && !busy;
            return (
              <span
                key={i}
                className={`flex h-12 w-10 items-center justify-center rounded-lg border font-mono text-[20px] transition-colors duration-200 sm:h-14 sm:w-12 ${
                  error ? "border-white/60" : active ? "border-white/20 group-focus-within:border-white" : filled ? "border-white/30" : "border-white/12"
                } ${filled ? "text-white" : "text-white/20"}`}
              >
                {code[i] ?? ""}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex min-h-6 items-center gap-3 text-[13px]">
        {busy ? (
          <span className="flex items-center gap-2 text-white/55">
            <Spinner /> Checking
          </span>
        ) : error ? (
          <span role="alert" className="text-white">
            {error}
          </span>
        ) : (
          <button
            type="button"
            disabled={resent}
            onClick={async () => {
              setResent(true);
              await onResend();
            }}
            className="text-white/55 underline-offset-4 hover:text-white hover:underline disabled:no-underline disabled:hover:text-white/55"
          >
            {resent ? "New code sent" : "Send a new code"}
          </button>
        )}
      </div>

      {challenge.devCode && <DevNote>Nothing was sent. Your code is <span className="font-mono text-white">{challenge.devCode}</span>.</DevNote>}
    </div>
  );
}

function BioCheck({ challenge, onVerified }: Pick<Props, "challenge" | "onVerified">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const code = challenge.code ?? "";

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const r = await confirmVerification(challenge.token, code);
      onVerified(r.proof);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[15px] leading-[1.6] text-white/80">
        To prove <span className="text-white">{challenge.identifier.value}</span> is yours, add this code to your GitHub or Bluesky bio. You can remove it once
        you&rsquo;re verified.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <code className="rounded-lg border border-white/20 px-4 py-3 font-mono text-[17px] tracking-wide text-white">{code}</code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code).catch(() => {});
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-4 text-[14px] text-white/80 transition-colors hover:border-white/50 hover:text-white"
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <button
        type="button"
        onClick={check}
        disabled={busy}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98] disabled:opacity-60"
      >
        {busy && <Spinner />}
        {busy ? "Checking your bio" : "I've added it, check now"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-white">
          {error}
        </p>
      )}
      {challenge.dev && <DevNote>The bio check is skipped, so you can press check right away.</DevNote>}
    </div>
  );
}

const POLL_MS = 2500;
const LINK_TTL_MS = 10 * 60 * 1000;

function TelegramCheck({ challenge, onVerified, onResend }: Omit<Props, "verified">) {
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [opened, setOpened] = useState(false);
  const verifiedRef = useRef(onVerified);
  useEffect(() => {
    verifiedRef.current = onVerified;
  }, [onVerified]);

  useEffect(() => {
    let stopped = false;
    const startedAt = Date.now();
    const tick = async () => {
      if (stopped) return;
      if (Date.now() - startedAt > LINK_TTL_MS) return setExpired(true);
      try {
        const r = await checkTelegram(challenge.token);
        if (stopped) return;
        if (r.proof) return verifiedRef.current(r.proof);
        setError(null);
      } catch (e) {
        if (stopped) return;
        if (/expired/i.test((e as Error).message)) return setExpired(true);
        setError((e as Error).message);
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    let timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [challenge.token]);

  if (expired) {
    return (
      <div>
        <p className="text-[15px] leading-[1.6] text-white/80">The Telegram link for {maskIdentifier(challenge.identifier)} has expired.</p>
        <button
          type="button"
          onClick={() => {
            setExpired(false);
            void onResend();
          }}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]"
        >
          Get a new link
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[15px] leading-[1.6] text-white/80">
        Confirm <span className="text-white">{maskIdentifier(challenge.identifier)}</span> with Telegram: open our bot and tap{" "}
        <span className="text-white">Share my phone number</span>. Telegram tells us the number on your account, so there&rsquo;s no code to type.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <a
          href={challenge.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.98]"
        >
          Open Telegram
          <External width={13} height={13} />
        </a>
        {opened && (
          <span className="inline-flex items-center gap-2 text-[13px] text-white/55" aria-live="polite">
            <Spinner />
            Waiting for Telegram
          </span>
        )}
      </div>
      <p className="mt-3 text-[13px] leading-[1.5] text-white/45">Use the Telegram account registered to this number. The link works for 10 minutes.</p>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-white">
          {error}
        </p>
      )}
    </div>
  );
}
