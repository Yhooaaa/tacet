import "server-only";
import { BROKERS } from "@/lib/brokers";
import { maskIdentifier } from "@/lib/identifiers";
import { addAlert, flagBrokerRechecks, listIdentifiers, type User } from "@/server/auth/account";
import { config } from "../config";
import { sendMail } from "@/server/notifications/mail";
import { query, run } from "../db";
import { purgeExpiredQuota } from "@/server/scan/quota";
import { checkBreaches } from "@/server/scan/sources/breaches";

const CHECK_EVERY_DAYS = 7;

type CheckResult = { newBreaches: string[]; rechecks: string[]; failed: boolean };

async function notify(user: User, subject: string, lines: string[]) {
  const text = `${lines.join("\n")}\n\nOpen your dashboard to see what to do: ${process.env.NOISE_APP_URL ?? "http://localhost:3000"}/dashboard`;
  if (!config.email) {
    console.info(`[noise] alert for ${maskIdentifier({ kind: "email", value: user.email })}: ${subject}`);
    return;
  }
  await sendMail(user.email, subject, text).catch((error) => console.error("[noise] alert email failed", error));
}

export async function checkUser(user: User): Promise<CheckResult> {
  const emails = (await listIdentifiers(user.id)).filter((i) => i.kind === "email");
  const newBreaches: string[] = [];
  let failures = 0;

  for (const email of emails) {
    let breaches: string[];
    try {
      breaches = (await checkBreaches(email)).names;
    } catch (error) {
      console.error("[noise] monitoring breach check failed", error);
      failures += 1;
      continue;
    }
    const known = new Set(
      (await query<{ breach: string }>("SELECT breach FROM known_breaches WHERE user_id = $1 AND email = $2", [user.id, email.value])).map((r) => r.breach),
    );
    const baseline = known.size === 0;
    for (const name of breaches) {
      if (known.has(name)) continue;
      await run("INSERT INTO known_breaches (user_id, email, breach, first_seen) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING", [user.id, email.value, name, Date.now()]);
      if (!baseline) {
        newBreaches.push(name);
        await addAlert(user.id, `${maskIdentifier(email)} appeared in the ${name} breach`, "Change that password and anywhere you reused it, and turn on two-factor sign-in.");
      }
    }
  }

  const rechecks = await flagBrokerRechecks(user.id);
  for (const id of rechecks) {
    const broker = BROKERS.find((b) => b.id === id);
    if (broker) await addAlert(user.id, `Check ${broker.name} again`, "It's been 90 days since you removed your listing. Brokers often add people back, so take a quick look.");
  }

  const failed = emails.length > 0 && failures === emails.length;
  if (!failed) {
    await run("UPDATE users SET last_checked_at = $1 WHERE id = $2", [Date.now(), user.id]);
  }

  if (newBreaches.length || rechecks.length) {
    const lines = [
      ...newBreaches.map((b) => `- Your email appeared in a new breach: ${b}`),
      ...rechecks.map((id) => `- Time to re-check ${BROKERS.find((b) => b.id === id)?.name ?? id}`),
    ];
    await notify(user, newBreaches.length ? "Tacet found a new breach" : "Time to re-check a data broker", lines);
  }

  return { newBreaches, rechecks, failed };
}

export async function runDueChecks(): Promise<{ checked: number; alerts: number }> {
  await purgeExpiredQuota();
  const cutoff = Date.now() - CHECK_EVERY_DAYS * 24 * 60 * 60 * 1000;
  const users = await query<User>(
    "SELECT * FROM users WHERE (plan = 'pro' OR $2) AND monitoring = 1 AND (last_checked_at IS NULL OR last_checked_at < $1) LIMIT 200",
    [cutoff, config.demoMode],
  );
  let alerts = 0;
  for (const user of users) {
    const r = await checkUser(user);
    alerts += r.newBreaches.length + r.rechecks.length;
  }
  return { checked: users.length, alerts };
}

export const MONITOR_INTERVAL_DAYS = CHECK_EVERY_DAYS;
