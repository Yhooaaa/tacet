import "server-only";
import type { Identifier, IdentifierKind } from "@/lib/identifiers";
import type { User } from "@/server/auth/account";
import { config } from "../config";
import { one, run, transaction } from "../db";
import { rateLimit } from "@/server/security/rate-limit";
import { hmac } from "@/server/auth/tokens";

const PLAN_LIMITS: Record<User["plan"], Record<IdentifierKind, number>> = {
  free: { email: 1, phone: 1, username: 3 },
  pro: { email: 5, phone: 3, username: 10 },
};

const IP_WINDOW_DAYS = 30;
const DETAIL_WINDOW_DAYS = 365;
const PRO_SCANS_PER_DAY = 20;
const DEMO_SCANS_PER_NETWORK = 100;

const DAY = 24 * 60 * 60 * 1000;

const SKIP = config.devMode && process.env.NOISE_SKIP_SCAN_QUOTA === "1";

type Key = { key: string; window: number; reason: QuotaReason };

type QuotaReason = "ip" | "detail" | "account";

const keysFor = (ip: string, identifiers: Identifier[], user: User | null): Key[] => [
  ...(ip === "unknown" ? [] : [{ key: `ip:${hmac(`free-ip:${ip}`)}`, window: IP_WINDOW_DAYS, reason: "ip" as const }]),
  ...identifiers.map((i) => ({ key: `id:${hmac(`free-id:${i.kind}:${i.value}`)}`, window: DETAIL_WINDOW_DAYS, reason: "detail" as const })),
  ...(user ? [{ key: `user:${hmac(`free-user:${user.email}`)}`, window: DETAIL_WINDOW_DAYS, reason: "account" as const }] : []),
];

async function usedBy(keys: Key[]): Promise<QuotaReason | null> {
  const now = Date.now();
  for (const k of keys) {
    const row = await one<{ used_at: number }>("SELECT used_at FROM free_scans WHERE key = $1", [k.key]);
    if (row && row.used_at > now - k.window * DAY) return k.reason;
  }
  return null;
}

export const QUOTA_MESSAGE: Record<QuotaReason, string> = {
  ip: "A free scan has already been run from this network. The free plan includes one scan per person.",
  detail: "One of these details has already had its free scan. The free plan includes one scan per person.",
  account: "Your account has already used its free scan. Monitoring keeps checking your details from your dashboard.",
};

export async function freeScanUsed(ip: string, identifiers: Identifier[], user: User | null): Promise<QuotaReason | null> {
  if (SKIP || config.demoMode || user?.plan === "pro") return null;
  return usedBy(keysFor(ip, identifiers, user));
}

type Claim = { ok: true; release: () => Promise<void> } | { ok: false; status: number; error: string };

class AlreadyUsed extends Error {
  constructor(readonly reason: QuotaReason) {
    super(reason);
  }
}

export async function claimScan(ip: string, identifiers: Identifier[], user: User | null): Promise<Claim> {
  const plan = config.demoMode ? "pro" : (user?.plan ?? "free");
  const limits = PLAN_LIMITS[plan];
  for (const kind of Object.keys(limits) as IdentifierKind[]) {
    const count = identifiers.filter((i) => i.kind === kind).length;
    if (count > limits[kind]) {
      const { email, phone, username } = limits;
      return {
        ok: false,
        status: 400,
        error: `One scan can include up to ${email} email${email > 1 ? "s" : ""}, ${phone} phone number${phone > 1 ? "s" : ""} and ${username} usernames. Remove some and try again.`,
      };
    }
  }

  if (SKIP) return { ok: true, release: async () => {} };
  if (plan === "pro") {
    if (!user) {
      if (!rateLimit(`demo-scan:${ip}`, DEMO_SCANS_PER_NETWORK, 24 * 60 * 60)) {
        return { ok: false, status: 429, error: "This network has run a lot of scans today. Try again tomorrow." };
      }
    } else if (!rateLimit(`pro-scan:${user.id}`, PRO_SCANS_PER_DAY, 24 * 60 * 60)) {
      return { ok: false, status: 429, error: `You've run ${PRO_SCANS_PER_DAY} scans today. Try again tomorrow.` };
    }
    return { ok: true, release: async () => {} };
  }

  const keys = keysFor(ip, identifiers, user);
  const now = Date.now();
  try {
    await transaction(async (tx) => {
      for (const k of keys) {
        const claimed = await run(
          "INSERT INTO free_scans (key, used_at) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET used_at = excluded.used_at WHERE free_scans.used_at <= $3",
          [k.key, now, now - k.window * DAY],
          tx,
        );
        if (!claimed) throw new AlreadyUsed(k.reason);
      }
    });
  } catch (error) {
    if (error instanceof AlreadyUsed) return { ok: false, status: 402, error: QUOTA_MESSAGE[error.reason] };
    throw error;
  }
  return {
    ok: true,
    release: async () => {
      for (const k of keys) await run("DELETE FROM free_scans WHERE key = $1 AND used_at = $2", [k.key, now]);
    },
  };
}

export async function purgeExpiredQuota() {
  await run("DELETE FROM free_scans WHERE key LIKE 'ip:%' AND used_at < $1", [Date.now() - IP_WINDOW_DAYS * DAY]);
  await run("DELETE FROM free_scans WHERE used_at < $1", [Date.now() - DETAIL_WINDOW_DAYS * DAY]);
}
