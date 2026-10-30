import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";

declare global {
  var __noisePool: pg.Pool | undefined;
  var __noiseSchema: Promise<void> | undefined;
}

pg.types.setTypeParser(pg.types.builtins.INT8, Number);

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    monitoring INTEGER NOT NULL DEFAULT 1,
    last_checked_at BIGINT,
    plan TEXT NOT NULL DEFAULT 'free'
  );

  CREATE TABLE IF NOT EXISTS identifiers (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    verified_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, kind, value)
  );

  CREATE TABLE IF NOT EXISTS known_breaches (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    breach TEXT NOT NULL,
    first_seen BIGINT NOT NULL,
    PRIMARY KEY (user_id, email, breach)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS broker_tasks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_id TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, broker_id)
  );

  CREATE TABLE IF NOT EXISTS free_scans (
    key TEXT PRIMARY KEY,
    used_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pro_waitlist (
    email TEXT PRIMARY KEY,
    created_at BIGINT NOT NULL,
    via TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS funnel (
    day TEXT NOT NULL,
    step TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, step)
  );

  CREATE TABLE IF NOT EXISTS telegram_checks (
    nonce TEXT PRIMARY KEY,
    phone_hash TEXT NOT NULL,
    chat_id BIGINT,
    verified INTEGER NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS alerts_by_user ON alerts (user_id, created_at);
  CREATE INDEX IF NOT EXISTS free_scans_by_age ON free_scans (used_at);
`;

type Runner = Pick<pg.Pool, "query">;

function pool(): pg.Pool {
  if (globalThis.__noisePool) return globalThis.__noisePool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Point it at a Postgres database, e.g. Neon from the Vercel Marketplace.");
  const created = new pg.Pool({ connectionString: connectionString.replace(/sslmode=require\b/, "sslmode=verify-full"), max: 5, idleTimeoutMillis: 5_000 });
  created.on("error", (error) => console.error("[noise] idle database connection failed", error));
  attachDatabasePool(created);
  globalThis.__noisePool = created;
  return created;
}

function ready(): Promise<void> {
  globalThis.__noiseSchema ??= pool()
    .query(SCHEMA)
    .then(
      () => undefined,
      (error) => {
        globalThis.__noiseSchema = undefined;
        throw error;
      },
    );
  return globalThis.__noiseSchema;
}

export async function query<T>(text: string, params: unknown[] = [], runner: Runner = pool()): Promise<T[]> {
  await ready();
  return (await runner.query(text, params)).rows as T[];
}

export async function one<T>(text: string, params: unknown[] = [], runner: Runner = pool()): Promise<T | undefined> {
  return (await query<T>(text, params, runner))[0];
}

export async function run(text: string, params: unknown[] = [], runner: Runner = pool()): Promise<number> {
  await ready();
  return (await runner.query(text, params)).rowCount ?? 0;
}

export async function transaction<T>(fn: (tx: Runner) => Promise<T>): Promise<T> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const connectDatabase = ready;
