"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { detectIdentifier } from "@/lib/identifiers";
import { api, startVerification, takeProofs, type StartResponse } from "@/lib/api";
import { Spinner } from "@/components/scan/icons";
import { CodeEntry } from "@/components/scan/verify-card";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard";
}

export default function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<StartResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/account")
      .then(() => router.replace(next))
      .catch(() => {});
  }, [router, next]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const detection = detectIdentifier(email);
    if (!detection.ok || detection.identifier.kind !== "email") {
      setError("Enter the email address you want to sign in with.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setChallenge(await startVerification(detection.identifier.value, "signin"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const signIn = useCallback(async (token: string, code: string) => {
    await api("/api/auth/signin", { method: "POST", body: { token, code } });
    return "";
  }, []);

  const finish = useCallback(async () => {
    const proofs = takeProofs();
    if (proofs.length) await api("/api/account/identifiers", { method: "POST", body: { proofs } }).catch(() => {});
    router.replace(next);
  }, [router, next]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-5 pb-[12vh]">
          <h1 className="font-display text-[34px] font-medium leading-[1.05] sm:text-[40px]">Sign in to Tacet</h1>
          <p className="mt-3 text-[16px] leading-[1.6] text-white/55">
            {challenge ? "Check your inbox." : "We'll email you a code. There's no password to remember, and your account is created the first time you sign in."}
          </p>

          {challenge ? (
            <div className="mt-8">
              <CodeEntry
                challenge={challenge}
                confirm={signIn}
                onVerified={finish}
                onResend={() => send()}
                purpose="Enter it to sign in."
              />
              <button type="button" onClick={() => setChallenge(null)} className="mt-6 text-[13px] text-white/55 underline-offset-4 hover:text-white hover:underline">
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="mt-8">
              <label htmlFor="email" className="text-[14px] text-white/65">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@example.com"
                aria-invalid={Boolean(error)}
                className="mt-2 h-12 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 text-[16px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/60"
              />
              {error && (
                <p role="alert" className="mt-2 text-[13px] text-white">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-black transition-[background-color,transform] hover:bg-white/85 active:scale-[0.99] disabled:opacity-60"
              >
                {busy && <Spinner />}
                Email me a code
              </button>
            </form>
          )}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
