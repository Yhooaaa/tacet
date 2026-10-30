import "server-only";
import { Resolver } from "node:dns/promises";
import { lookup as systemLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, fetch as undiciFetch, request as undiciRequest } from "undici";
import { BoundedMap, envInt, FairSemaphore, KeyedLimiter, type Release } from "@/server/utils/limiter";
import { currentScan, requestSignal } from "./context";

const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) PRIVATE.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 127], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) PRIVATE.addSubnet(net, prefix, "ipv6");

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !PRIVATE.check(address, "ipv4");
  if (family !== 6) return false;
  const lower = address.toLowerCase();
  const embedded = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (embedded) return isPublicAddress(embedded);
  if (lower.startsWith("::ffff:") || lower.startsWith("64:ff9b::")) return false;
  return !PRIVATE.check(address, "ipv6");
}

const blocked = (hostname: string) => Object.assign(new Error(`${hostname} resolves to a private address`), { code: "EBLOCKED" });

const resolver = new Resolver({ timeout: 3000, tries: 2 });
const dnsServers = process.env.NOISE_DNS_SERVERS?.split(",").map((s) => s.trim()).filter(Boolean);
if (dnsServers?.length) resolver.setServers(dnsServers);
const TTL = 10 * 60 * 1000;
const cache = new BoundedMap<string, { addresses: LookupAddress[]; at: number }>(20_000);

async function resolveHost(hostname: string): Promise<LookupAddress[]> {
  const hit = cache.get(hostname);
  if (hit && Date.now() - hit.at < TTL) return hit.addresses;
  const [v4, v6] = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
  const addresses = [
    ...(v4.status === "fulfilled" ? v4.value.map((address) => ({ address, family: 4 })) : []),
    ...(v6.status === "fulfilled" ? v6.value.map((address) => ({ address, family: 6 })) : []),
  ];
  if (!addresses.length) {
    const reason = v4.status === "rejected" ? (v4.reason as NodeJS.ErrnoException) : null;
    throw Object.assign(new Error(`DNS lookup failed for ${hostname}`), { code: reason?.code === "ENODATA" ? "ENOTFOUND" : (reason?.code ?? "ENOTFOUND") });
  }
  const publicOnly = addresses.filter((a) => isPublicAddress(a.address));
  if (!publicOnly.length) throw blocked(hostname);
  cache.set(hostname, { addresses: publicOnly, at: Date.now() });
  return publicOnly;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

const SYSTEM_LOOKUPS = 2;
let systemLookups = 0;

function lookup(hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback) {
  resolveHost(hostname).then(
    (addresses) => {
      const usable = options.family ? addresses.filter((a) => a.family === options.family) : addresses;
      const list = usable.length ? usable : addresses;
      if (options.all) callback(null, list);
      else callback(null, list[0].address, list[0].family);
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EBLOCKED") return callback(error, options.all ? [] : "");
      if (systemLookups >= SYSTEM_LOOKUPS) return callback(Object.assign(error, { code: error.code ?? "ENOTFOUND" }), options.all ? [] : "");
      systemLookups += 1;
      systemLookup(hostname, { all: true }, (sysErr, sysAddresses) => {
        systemLookups -= 1;
        if (sysErr || !sysAddresses.length) return callback(Object.assign(error, { code: error.code ?? "ENOTFOUND" }), options.all ? [] : "");
        const usable = sysAddresses.filter((a) => isPublicAddress(a.address));
        if (!usable.length) return callback(blocked(hostname), options.all ? [] : "");
        if (options.all) callback(null, usable);
        else callback(null, usable[0].address, usable[0].family);
      });
    },
  );
}

const agent = new Agent({
  connect: { lookup: lookup as never, timeout: 6000 },
  connections: 8,
  keepAliveTimeout: 10_000,
});

const MAX_REDIRECTS = 5;

function assertFetchable(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw Object.assign(new Error(`Refusing ${url.protocol} URL`), { code: "EBLOCKED" });
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw blocked(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw blocked(host);
}

export async function scanFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const manual = init.redirect === "manual";
  let current = new URL(url);
  let request = init;
  for (let hop = 0; ; hop++) {
    const target = FAKE_UPSTREAM ? viaFakeUpstream(current, request) : null;
    if (!target) assertFetchable(current);
    const res = await undiciFetch(target?.url ?? current, {
      ...(target?.init ?? (request as object)),
      redirect: "manual",
      dispatcher: target?.dispatcher ?? agent,
    } as Parameters<typeof undiciFetch>[1]);
    const location = res.headers.get("location");
    if (manual || res.status < 300 || res.status > 399 || !location || hop >= MAX_REDIRECTS) return res as unknown as Response;
    await res.body?.cancel().catch(() => {});
    current = new URL(location, current);
    const method = (request.method ?? "GET").toUpperCase();
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== "GET" && method !== "HEAD")) {
      request = { ...request, method: "GET", body: undefined };
    }
  }
}

const FAKE_UPSTREAM = (() => {
  const raw = process.env.NOISE_FAKE_UPSTREAM?.trim();
  if (!raw) return null;
  const devMode = process.env.NOISE_DEV_MODE === "1" || process.env.NODE_ENV !== "production";
  if (!devMode) throw new Error("NOISE_FAKE_UPSTREAM only works in dev mode.");
  console.warn(`[noise] load-test mode: scan traffic goes to ${raw}, not the real sites`);
  return new URL(raw);
})();

const fakeAgent = FAKE_UPSTREAM ? new Agent({ connections: 4096, keepAliveTimeout: 10_000 }) : null;

function viaFakeUpstream(url: URL, init: RequestInit) {
  if (!FAKE_UPSTREAM) return null;
  const headers = new Headers(init.headers);
  headers.set("x-noise-target", url.href);
  return { url: new URL("/", FAKE_UPSTREAM), init: { ...init, headers }, dispatcher: fakeAgent! };
}


const PROCESS_LIMIT = new FairSemaphore(envInt("NOISE_OUTBOUND_LIMIT", 1536));
const HOST_LIMIT = new KeyedLimiter(envInt("NOISE_HOST_LIMIT", 6));
const SLOT_WAIT_MS = envInt("NOISE_SLOT_WAIT_MS", 30_000);

const hostKey = (url: string | URL) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

export async function outbound<T>(url: string | URL, fn: () => Promise<T>): Promise<T> {
  const scan = currentScan();
  const waitStarted = Date.now();
  const releaseHost = await HOST_LIMIT.acquire(hostKey(url), scan?.id, scan?.signal, SLOT_WAIT_MS);
  let releaseProcess: Release;
  try {
    releaseProcess = await PROCESS_LIMIT.acquire(scan?.id, scan?.signal, Math.max(1, SLOT_WAIT_MS - (Date.now() - waitStarted)));
  } catch (error) {
    releaseHost();
    throw error;
  }
  try {
    return await fn();
  } finally {
    releaseProcess();
    releaseHost();
  }
}

export const outboundStats = () => ({
  active: PROCESS_LIMIT.active,
  waiting: PROCESS_LIMIT.queued,
  limit: PROCESS_LIMIT.capacity,
  hosts: HOST_LIMIT.size,
  dnsCache: cache.size,
});

export type LightResponse = {
  status: number;
  location: string | null;
  read: (maxBytes: number) => Promise<string>;
  discard: () => Promise<void>;
};

export async function scanRequest(
  url: string,
  { method = "GET", headers = {}, body, signal }: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
): Promise<LightResponse> {
  const current = new URL(url);
  if (!FAKE_UPSTREAM) assertFetchable(current);
  const res = await undiciRequest(FAKE_UPSTREAM ? new URL("/", FAKE_UPSTREAM) : current, {
    method: method as "GET",
    headers: FAKE_UPSTREAM ? { ...headers, "x-noise-target": current.href } : headers,
    body,
    signal,
    dispatcher: fakeAgent ?? agent,
  });
  const location = res.headers.location;
  return {
    status: res.statusCode,
    location: (Array.isArray(location) ? location[0] : location) ?? null,
    read: async (maxBytes) => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of res.body) {
        chunks.push(chunk as Buffer);
        size += (chunk as Buffer).length;
        if (size >= maxBytes) break;
      }
      res.body.destroy();
      return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
    },
    discard: () => res.body.dump({ limit: 64 * 1024 }).catch(() => {}),
  };
}

export async function readBody(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

function retryDelay(res: Response, attempt: number) {
  const header = Number(res.headers.get("retry-after"));
  const asked = Number.isFinite(header) && header > 0 ? header * 1000 : 0;
  return Math.min(Math.max(asked, 800 * 2 ** attempt), 8000) + Math.random() * 400;
}

class UpstreamError extends Error {
  constructor(readonly service: string, readonly status: number) {
    super(`${service} returned ${status}`);
  }
}

export async function getJson<T>(
  service: string,
  url: string,
  { headers, timeout = 15_000, empty = [404] }: { headers?: Record<string, string>; timeout?: number; empty?: number[] } = {},
): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const outcome = await outbound<{ data: T | null } | { status: number; wait: number }>(url, async () => {
      const res = await scanFetch(url, { headers, signal: requestSignal(timeout) });
      if (empty.includes(res.status)) {
        await res.body?.cancel();
        return { data: null };
      }
      if (res.ok) return { data: (await res.json()) as T };
      await res.body?.cancel();
      return { status: res.status, wait: retryDelay(res, attempt) };
    });
    if ("data" in outcome) return outcome.data;
    const retryable = outcome.status === 429 || outcome.status === 502 || outcome.status === 503 || outcome.status === 504;
    if (!retryable || attempt >= 2) throw new UpstreamError(service, outcome.status);
    await sleep(outcome.wait, currentScan()?.signal);
  }
}
