import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { BROKER_IDS, RELIST_DAYS, type BrokerStatus } from "@/lib/brokers";
import type { Identifier, IdentifierKind } from "@/lib/identifiers";
import { config } from "../config";
import { one, query, run } from "../db";
import { leaveWaitlist } from "@/server/analytics/funnel";
import { sign, verify } from "./tokens";

const SESSION_COOKIE = "tacet_session";
const SESSION_DAYS = 30;

export type User = { id: string; email: string; created_at: number; monitoring: number; last_checked_at: number | null; plan: "free" | "pro" };

type Alert = { id: string; created_at: number; title: string; detail: string; read: number };

type BrokerTask = { broker_id: string; status: BrokerStatus; updated_at: number };

export async function startSession(userId: string) {
  const token = sign({ purpose: "session", uid: userId }, SESSION_DAYS * 24 * 60 * 60);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: !config.devMode,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const session = verify<{ purpose: string; uid: string }>((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.purpose !== "session") return null;
  const user = await one<User>("SELECT * FROM users WHERE id = $1", [session.uid]);
  if (!user) return null;
  return config.demoMode ? { ...user, plan: "pro" } : user;
}

export async function findOrCreateUser(email: string): Promise<User> {
  const created = await one<User>("INSERT INTO users (id, email, created_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING *", [
    randomUUID(),
    email,
    Date.now(),
  ]);
  if (!created) return (await one<User>("SELECT * FROM users WHERE email = $1", [email]))!;
  await addIdentifier(created.id, { kind: "email", value: email });
  return created;
}

export async function addIdentifier(userId: string, identifier: Identifier) {
  await run(
    "INSERT INTO identifiers (user_id, kind, value, verified_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, kind, value) DO UPDATE SET verified_at = excluded.verified_at",
    [userId, identifier.kind, identifier.value, Date.now()],
  );
}

export async function removeIdentifier(userId: string, identifier: Identifier) {
  await run("DELETE FROM identifiers WHERE user_id = $1 AND kind = $2 AND value = $3", [userId, identifier.kind, identifier.value]);
  if (identifier.kind === "email") {
    await run("DELETE FROM known_breaches WHERE user_id = $1 AND email = $2", [userId, identifier.value]);
  }
}

export function listIdentifiers(userId: string) {
  return query<Identifier & { verified_at: number; kind: IdentifierKind }>("SELECT kind, value, verified_at FROM identifiers WHERE user_id = $1 ORDER BY verified_at", [
    userId,
  ]);
}

export async function setMonitoring(userId: string, on: boolean) {
  await run("UPDATE users SET monitoring = $1 WHERE id = $2", [on ? 1 : 0, userId]);
}

export async function deleteUser(userId: string) {
  const user = await one<{ email: string }>("SELECT email FROM users WHERE id = $1", [userId]);
  if (user) await leaveWaitlist(user.email);
  await run("DELETE FROM users WHERE id = $1", [userId]);
}

export async function addAlert(userId: string, title: string, detail: string) {
  await run("INSERT INTO alerts (id, user_id, created_at, title, detail) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), userId, Date.now(), title, detail]);
}

export function listAlerts(userId: string) {
  return query<Alert>("SELECT id, created_at, title, detail, read FROM alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [userId]);
}

export async function markAlertsRead(userId: string) {
  await run("UPDATE alerts SET read = 1 WHERE user_id = $1", [userId]);
}

export function listBrokerTasks(userId: string) {
  return query<BrokerTask>("SELECT broker_id, status, updated_at FROM broker_tasks WHERE user_id = $1", [userId]);
}

export async function setBrokerStatus(userId: string, brokerId: string, status: BrokerStatus) {
  if (!BROKER_IDS.has(brokerId)) throw new Error("Unknown broker");
  if (status === "todo") {
    await run("DELETE FROM broker_tasks WHERE user_id = $1 AND broker_id = $2", [userId, brokerId]);
    return;
  }
  await run(
    "INSERT INTO broker_tasks (user_id, broker_id, status, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, broker_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
    [userId, brokerId, status, Date.now()],
  );
}

export async function flagBrokerRechecks(userId: string): Promise<string[]> {
  const cutoff = Date.now() - RELIST_DAYS * 24 * 60 * 60 * 1000;
  const due = await query<{ broker_id: string }>("SELECT broker_id FROM broker_tasks WHERE user_id = $1 AND status = 'removed' AND updated_at < $2", [userId, cutoff]);
  for (const { broker_id } of due) await setBrokerStatus(userId, broker_id, "recheck");
  return due.map((d) => d.broker_id);
}
