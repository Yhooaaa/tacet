import "server-only";
import { isIP } from "node:net";

type Bucket = { count: number; reset: number };

declare global {
  var __noiseBuckets: Map<string, Bucket> | undefined;
}

const buckets = (globalThis.__noiseBuckets ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowSeconds * 1000 });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function underLimit(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  return !bucket || bucket.reset < Date.now() || bucket.count < limit;
}

const IP_HEADER = process.env.NOISE_IP_HEADER?.trim().toLowerCase() || null;
const HOPS = Math.max(1, Number.parseInt(process.env.NOISE_TRUSTED_PROXY_HOPS ?? "1", 10) || 1);

function normalizeIp(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return mapped;
  if (isIP(ip) !== 6) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

export function clientIp(request: Request): string {
  if (IP_HEADER) {
    const value = request.headers.get(IP_HEADER)?.split(",")[0];
    if (value && isIP(value.trim().replace(/^\[|\]$/g, ""))) return normalizeIp(value);
  }
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = chain[Math.max(0, chain.length - HOPS)] ?? request.headers.get("x-real-ip") ?? "";
  return isIP(ip.replace(/^\[|\]$/g, "")) ? normalizeIp(ip) : "unknown";
}
