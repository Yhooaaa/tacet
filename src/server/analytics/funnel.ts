import "server-only";
import { one, query, run } from "../db";

export const FUNNEL_STEPS = ["landing", "verify_started", "scan_started", "scan_finished", "pro_reserved"] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const CLIENT_STEPS = new Set<FunnelStep>(["landing"]);

const today = () => new Date().toISOString().slice(0, 10);

export async function countStep(step: FunnelStep) {
  try {
    await run("INSERT INTO funnel (day, step, count) VALUES ($1, $2, 1) ON CONFLICT (day, step) DO UPDATE SET count = funnel.count + 1", [today(), step]);
  } catch (error) {
    console.error("[noise] funnel count failed", error);
  }
}

export async function funnelStats(days = 30) {
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await query<{ day: string; step: FunnelStep; count: number }>("SELECT day, step, count FROM funnel WHERE day >= $1 ORDER BY day", [since]);
  const totals = Object.fromEntries(FUNNEL_STEPS.map((s) => [s, 0])) as Record<FunnelStep, number>;
  const byDay: Record<string, Partial<Record<FunnelStep, number>>> = {};
  for (const r of rows) {
    if (r.step in totals) totals[r.step] += r.count;
    (byDay[r.day] ??= {})[r.step] = r.count;
  }
  return { days, totals, byDay, waitlist: await waitlistSize() };
}

export async function reservePro(email: string, via: string): Promise<boolean> {
  return (await run("INSERT INTO pro_waitlist (email, created_at, via) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING", [email, Date.now(), via])) > 0;
}

export async function leaveWaitlist(email: string) {
  await run("DELETE FROM pro_waitlist WHERE email = $1", [email]);
}

const waitlistSize = async () => (await one<{ n: number }>("SELECT COUNT(*) AS n FROM pro_waitlist"))!.n;
