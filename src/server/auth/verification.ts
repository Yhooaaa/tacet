import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import type { Identifier } from "@/lib/identifiers";
import { config, USER_AGENT } from "../config";
import { sendMail } from "@/server/notifications/mail";
import { startTelegramCheck, takeTelegramCheck } from "@/server/notifications/telegram";
import { rateLimit, underLimit } from "@/server/security/rate-limit";
import { hmac, safeCompare, sign, verify } from "./tokens";

const CODE_TTL = 10 * 60;
const PROOF_TTL = 60 * 60;
const MAX_ATTEMPTS = 5;
const MAX_DAILY_FAILURES = 10;

type Challenge = Identifier & { purpose: "challenge"; nonce: string; hash: string; via?: "telegram" };
type Proof = Identifier & { purpose: "proof" };

type StartResult =
  | { ok: true; token: string; method: "email" | "sms" | "bio" | "telegram"; code?: string; devCode?: string; link?: string }
  | { ok: false; status: number; error: string };

declare global {
  var __noiseAttempts: Map<string, { count: number; exp: number }> | undefined;
}
const attempts = (globalThis.__noiseAttempts ??= new Map<string, { count: number; exp: number }>());

function recordAttempt(nonce: string, exp: number, count: number) {
  attempts.set(nonce, { count, exp });
  if (attempts.size > 10_000) {
    const now = Date.now();
    for (const [k, v] of attempts) if (v.exp < now) attempts.delete(k);
  }
}

function newCode(kind: Identifier["kind"]): string {
  if (kind === "username") {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return `tacet-${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
  }
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

const sendEmail = (to: string, code: string) =>
  sendMail(
    to,
    `${code} is your Tacet code`,
    `Your Tacet verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
  );

async function sendSms(to: string, code: string) {
  const { sid, token, from } = config.twilio!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: `Your Tacet code is ${code}. It expires in 10 minutes.` }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`SMS provider returned ${res.status}`);
}

export async function startVerification(identifier: Identifier): Promise<StartResult> {
  const code = newCode(identifier.kind);
  const nonce = randomBytes(12).toString("base64url");
  const token = sign<Challenge>(
    { ...identifier, purpose: "challenge", nonce, hash: hmac(`${nonce}:${code}`) },
    CODE_TTL,
  );

  if (identifier.kind === "username") {
    return { ok: true, token, method: "bio", code };
  }

  if (identifier.kind === "phone" && config.telegram) {
    const expiresAt = Date.now() + CODE_TTL * 1000;
    try {
      const link = await startTelegramCheck(nonce, identifier.value, expiresAt);
      const telegramToken = sign<Challenge>({ ...identifier, purpose: "challenge", nonce, hash: "", via: "telegram" }, CODE_TTL);
      return { ok: true, token: telegramToken, method: "telegram", link };
    } catch (error) {
      console.error("[noise] Telegram check failed to start", error);
      return { ok: false, status: 503, error: "Phone verification through Telegram isn't available right now. Try again in a minute, or verify an email instead." };
    }
  }

  const method = identifier.kind === "email" ? "email" : "sms";
  const provider = method === "email" ? config.email : config.twilio;

  if (!provider) {
    if (config.devMode) return { ok: true, token, method, devCode: code };
    return { ok: false, status: 503, error: `${method === "email" ? "Email" : "SMS"} verification isn't set up yet.` };
  }

  try {
    if (method === "email") await sendEmail(identifier.value, code);
    else await sendSms(identifier.value, code);
  } catch (error) {
    console.error("[noise] verification send failed", error);
    return { ok: false, status: 502, error: "We couldn't send the code. Check the address or number and try again." };
  }
  return { ok: true, token, method };
}

async function bioContains(username: string, code: string): Promise<boolean> {
  const headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/json" };
  const checks = [
    async () => {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers: config.githubToken ? { ...headers, authorization: `Bearer ${config.githubToken}` } : headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { bio?: string | null };
      return Boolean(data.bio?.includes(code));
    },
    async () => {
      const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(username)}.bsky.social`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { description?: string };
      return Boolean(data.description?.includes(code));
    },
  ];
  const results = await Promise.allSettled(checks.map((check) => check()));
  return results.some((r) => r.status === "fulfilled" && r.value);
}

type ConfirmResult = { ok: true; proof: string; identifier: Identifier } | { ok: false; status: number; error: string };

export async function confirmVerification(token: unknown, code: unknown): Promise<ConfirmResult> {
  const challenge = verify<Challenge>(token);
  if (!challenge || challenge.purpose !== "challenge") {
    return { ok: false, status: 400, error: "This code has expired. Request a new one." };
  }

  if (challenge.via === "telegram") return { ok: false, status: 400, error: "Confirm this number in Telegram instead." };

  const used = attempts.get(challenge.nonce)?.count ?? 0;
  if (used >= MAX_ATTEMPTS) return { ok: false, status: 429, error: "This code can't be used any more. Request a new one." };

  const identifier: Identifier = { kind: challenge.kind, value: challenge.value };
  const failureKey = `fail:${identifier.kind}:${identifier.value}`;
  if (!underLimit(failureKey, MAX_DAILY_FAILURES)) {
    return { ok: false, status: 429, error: "Too many wrong codes for this detail today. Try again tomorrow." };
  }
  const fail = () => {
    recordAttempt(challenge.nonce, challenge.exp, used + 1);
    rateLimit(failureKey, MAX_DAILY_FAILURES, 24 * 60 * 60);
  };

  if (identifier.kind === "username") {
    const claimed = typeof code === "string" ? code.trim() : "";
    const matches = claimed && safeCompare(hmac(`${challenge.nonce}:${claimed}`), challenge.hash);
    const placed = matches && (config.devMode || (await bioContains(identifier.value, claimed)));
    if (!placed) {
      fail();
      return {
        ok: false,
        status: 400,
        error: "We couldn't find the code in your GitHub or Bluesky bio yet. Save your profile and try again.",
      };
    }
  } else {
    const entered = typeof code === "string" ? code.replace(/\D/g, "") : "";
    if (entered.length !== 6 || !safeCompare(hmac(`${challenge.nonce}:${entered}`), challenge.hash)) {
      fail();
      return { ok: false, status: 400, error: "That code isn't right. Check it and try again." };
    }
  }

  recordAttempt(challenge.nonce, challenge.exp, MAX_ATTEMPTS);
  return { ok: true, proof: sign<Proof>({ ...identifier, purpose: "proof" }, PROOF_TTL), identifier };
}

export async function checkTelegramVerification(token: unknown): Promise<ConfirmResult | { pending: true }> {
  const challenge = verify<Challenge>(token);
  if (!challenge || challenge.purpose !== "challenge" || challenge.via !== "telegram") {
    return { ok: false, status: 400, error: "This link has expired. Enter your number again." };
  }
  const state = await takeTelegramCheck(challenge.nonce);
  if (state === "pending") return { pending: true };
  if (state === "expired") return { ok: false, status: 400, error: "This link has expired. Enter your number again." };
  const identifier: Identifier = { kind: challenge.kind, value: challenge.value };
  return { ok: true, proof: sign<Proof>({ ...identifier, purpose: "proof" }, PROOF_TTL), identifier };
}

export function readProof(token: unknown): Identifier | null {
  const proof = verify<Proof>(token);
  if (!proof || proof.purpose !== "proof") return null;
  return { kind: proof.kind, value: proof.value };
}
