import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config";

declare global {
  var __noiseSecret: string | undefined;
}

function secret(): string {
  if (config.secret) return config.secret;
  if (!config.devMode) throw new Error("NOISE_SECRET must be set outside dev mode.");
  globalThis.__noiseSecret ??= randomBytes(32).toString("hex");
  return globalThis.__noiseSecret;
}

export function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function sign<T extends object>(payload: T, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verify<T>(token: unknown): (T & { exp: number }) | null {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof payload.exp === "number" && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function safeCompare(a: string, b: string) {
  return safeEqual(a, b);
}
