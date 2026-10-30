"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { detectIdentifier, KIND_LABEL, type IdentifierKind } from "@/lib/identifiers";
import { ArrowUp, At, Mail, Phone, Spinner } from "./icons";

const EXAMPLES = ["you@example.com", "+44 20 7946 0958", "nightowl_92"];

const KIND_ICON: Record<IdentifierKind, typeof Mail> = { email: Mail, phone: Phone, username: At };

type Props = {
  onSubmit: (value: string) => Promise<boolean>;
  disabled?: boolean;
  disabledHint?: string;
  invite?: boolean;
  autoFocus?: boolean;
};

export default function Composer({ onSubmit, disabled, disabledHint, invite, autoFocus }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [example, setExample] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const detection = value.trim() ? detectIdentifier(value) : null;
  const kind = detection ? (detection.ok ? detection.identifier.kind : detection.kind) : undefined;
  const KindIcon = kind ? KIND_ICON[kind] : null;
  const canSend = Boolean(detection?.ok) && !busy && !disabled;

  useEffect(() => {
    if (value || disabled) return;
    const t = window.setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => window.clearInterval(t);
  }, [value, disabled]);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true });
  }, [disabled]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!detection) return;
    if (!detection.ok) {
      setError(detection.error);
      return;
    }
    if (!canSend) return;
    setBusy(true);
    setError(null);
    const accepted = await onSubmit(value);
    setBusy(false);
    if (accepted) setValue("");
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={`composer relative rounded-[22px] border bg-[#0d0d0d] transition-[border-color,box-shadow] duration-300 focus-within:border-white/40 ${
          invite && !value ? "composer-invite" : ""
        } ${error ? "border-white/40" : "border-white/15"} ${disabled ? "opacity-60" : ""}`}
      >
        <label htmlFor="identifier" className="sr-only">
          Email, phone number or username
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="identifier"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            disabled={disabled || busy}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            aria-invalid={Boolean(error)}
            aria-describedby="composer-hint"
            className="w-full rounded-t-[22px] bg-transparent px-5 pb-2 pt-[18px] text-[17px] text-white outline-none placeholder:text-transparent disabled:cursor-not-allowed"
            placeholder="Email, phone number or username"
          />
          {!value && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-[18px] flex h-[26px] overflow-hidden text-[17px] text-white/35">
              {disabled ? (
                <span>{disabledHint}</span>
              ) : (
                <>
                  <span className="whitespace-pre sm:hidden">Email, phone or username</span>
                  <span className="hidden whitespace-pre sm:inline">Enter your email, phone or username, like </span>
                  <span className="relative hidden flex-1 sm:block">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.span
                        key={example}
                        className="absolute left-0 font-mono text-[15px] leading-[26px] text-white/55"
                        initial={{ y: 18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -18, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {EXAMPLES[example]}
                      </m.span>
                    </AnimatePresence>
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <div className="flex min-h-8 items-center pl-2">
            <AnimatePresence initial={false}>
              {kind && KindIcon && (
                <m.span
                  key={kind}
                  initial={{ opacity: 0, scale: 0.9, filter: "blur(3px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/15 px-2.5 text-[12px] text-white/70"
                >
                  <KindIcon width={13} height={13} />
                  {KIND_LABEL[kind]}
                </m.span>
              )}
            </AnimatePresence>
          </div>
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Add"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-[opacity,transform,background-color] duration-200 hover:bg-white/85 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
          >
            {busy ? <Spinner /> : <ArrowUp />}
          </button>
        </div>
      </div>

      <p id="composer-hint" role={error ? "alert" : undefined} className={`mt-3 min-h-5 px-2 text-[13px] ${error ? "text-white" : "text-white/40"}`}>
        {error ?? (detection && !detection.ok ? detection.error : "You'll confirm each email and phone number is yours before it's searched.")}
      </p>
    </form>
  );
}
