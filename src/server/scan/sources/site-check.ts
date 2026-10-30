import "server-only";
import { BoundedMap, singleFlight } from "@/server/utils/limiter";
import { requestSignal, scanCancelled } from "../context";
import { outbound, scanRequest } from "../net";

export type CodeSpec = number | "2xx" | "any";
type Texts = string | string[];

export type SiteRule = { code: CodeSpec | CodeSpec[]; text?: Texts; without?: Texts };

export type SiteDef = {
  name: string;
  check: string;
  pretty?: string;
  method?: "GET" | "POST" | "HEAD";
  body?: string;
  headers?: Record<string, string>;
  found: SiteRule;
  missing?: SiteRule | SiteRule[];
  errors?: string[];
  pattern?: string;
  noRedirect?: boolean;
  strip?: string;
  category?: string;
};

export type SiteState = "found" | "missing" | "unknown";

export type SiteResult = { site: SiteDef; url: string; state: SiteState; title?: string; reason?: string };

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const TIMEOUT = 8000;
const MAX_REDIRECTS = 3;
const MAX_BODY = 1_500_000;

const list = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function codeMatches(spec: SiteRule["code"], status: number) {
  return list(spec).some((c) => c === "any" || (c === "2xx" ? status >= 200 && status < 300 : c === status));
}

function ruleMatches(rule: SiteRule, status: number, body: string) {
  return codeMatches(rule.code, status) && (!rule.text || list(rule.text).some((t) => body.includes(t))) && !list(rule.without).some((t) => body.includes(t));
}

const patterns = new Map<string, RegExp | null>();
function fitsPattern(site: SiteDef, account: string) {
  if (!site.pattern) return true;
  if (!patterns.has(site.pattern)) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(site.pattern, "u");
    } catch {
      try {
        re = new RegExp(site.pattern);
      } catch {}
    }
    patterns.set(site.pattern, re);
  }
  return patterns.get(site.pattern)?.test(account) ?? true;
}
const isSubdomain = (site: SiteDef) => /\/\/[^/]*\{account\}/.test(site.check);

function fill(template: string, account: string) {
  return template.replaceAll("{account}", account);
}

function accountFor(site: SiteDef, username: string) {
  if (!site.strip) return username;
  let out = username;
  for (const ch of site.strip) out = out.replaceAll(ch, "");
  return out;
}

const TITLE_BYTES = 64 * 1024;

const needsText = (rule: SiteRule) => Boolean(rule.text || rule.without);

function bodyNeeded(site: SiteDef, status: number): number {
  if (site.method === "HEAD") return 0;
  if (site.errors?.length) return MAX_BODY;
  const rules = [site.found, ...list(site.missing)].filter((r) => codeMatches(r.code, status));
  if (rules.some(needsText)) return MAX_BODY;
  return codeMatches(site.found.code, status) ? TITLE_BYTES : 0;
}

function decodeTitle(html: string) {
  const raw = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim();
  if (!raw) return undefined;
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

async function request(site: SiteDef, account: string, signal: AbortSignal) {
  let url = fill(site.check, account);
  let method: string = site.method ?? (site.body ? "POST" : "GET");
  let body = site.body ? fill(site.body, account) : undefined;
  const expected = [...list(site.found.code), ...list(site.missing).flatMap((m) => list(m.code))].filter((c): c is number => typeof c === "number");
  for (let hop = 0; ; hop++) {
    const res = await scanRequest(url, {
      method,
      body,
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        ...site.headers,
      },
      signal,
    });
    const location = res.location;
    if (!site.noRedirect && res.status >= 300 && res.status < 400 && location && !expected.includes(res.status) && hop < MAX_REDIRECTS) {
      await res.discard();
      url = new URL(location, url).href;
      method = "GET";
      body = undefined;
      continue;
    }
    return res;
  }
}

const DEAD_FOR = { connect: 6 * 60 * 60 * 1000, slow: 60 * 60 * 1000 };
const SLOW_STRIKES = 3;
const TRANSIENT_FAILURES = new Set(["TimeoutError", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "EAI_AGAIN", "ETIMEOUT"]);
const CONNECT_FAILURES = new Set([
  "ENOTFOUND", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "EBLOCKED",
  "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);
const deadHosts = new BoundedMap<string, number>(20_000);
const slowStrikes = new BoundedMap<string, number>(20_000);

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

function noteFailure(site: SiteDef, url: string, reason: string) {
  if (isSubdomain(site)) return;
  const host = hostOf(url);
  if (CONNECT_FAILURES.has(reason)) {
    deadHosts.set(host, Date.now() + DEAD_FOR.connect);
  } else if (TRANSIENT_FAILURES.has(reason)) {
    const strikes = (slowStrikes.get(host) ?? 0) + 1;
    slowStrikes.set(host, strikes);
    if (strikes >= SLOW_STRIKES) {
      deadHosts.set(host, Date.now() + DEAD_FOR.slow);
      slowStrikes.delete(host);
    }
  }
}

const noteAnswer = (site: SiteDef, url: string) => {
  if (!isSubdomain(site)) slowStrikes.delete(hostOf(url));
};

export const unreachableHosts = () => deadHosts.size;

const isDead = (url: string) => (deadHosts.get(hostOf(url)) ?? 0) > Date.now();

function failureReason(error: unknown): string {
  const err = error as { name?: string; code?: unknown; cause?: { code?: unknown } };
  if (typeof err?.cause?.code === "string") return err.cause.code;
  if (typeof err?.code === "string") return err.code;
  return err?.name ?? "error";
}

async function checkSite(site: SiteDef, username: string): Promise<SiteResult> {
  const account = accountFor(site, username);
  const url = fill(site.pretty ?? site.check, account);
  if (!fitsPattern(site, account)) return { site, url, state: "missing", reason: "pattern" };
  const target = fill(site.check, account);
  if (!isSubdomain(site) && isDead(target)) return { site, url, state: "unknown", reason: "unreachable" };
  try {
    const { res, body } = await outbound(target, async () => {
      const res = await request(site, account, requestSignal(TIMEOUT));
      const bytes = bodyNeeded(site, res.status);
      if (!bytes) await res.discard();
      return { res, body: bytes ? await res.read(bytes) : "" };
    });
    noteAnswer(site, target);
    const reason = String(res.status);
    if (site.errors?.some((e) => body.includes(e))) return { site, url, state: "unknown", reason: "refused" };
    if (ruleMatches(site.found, res.status, body)) return { site, url, state: "found", title: decodeTitle(body), reason };
    if (list(site.missing).some((m) => ruleMatches(m, res.status, body))) return { site, url, state: "missing", reason };
    return { site, url, state: "unknown", reason };
  } catch (error) {
    const reason = failureReason(error);
    if (isSubdomain(site) && reason === "ENOTFOUND") return { site, url, state: "missing", reason };
    noteFailure(site, target, reason);
    return { site, url, state: "unknown", reason };
  }
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, deadline?: { at: number; late: (item: T) => R }): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = deadline && (Date.now() > deadline.at || scanCancelled()) ? deadline.late(items[i]) : await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const BASELINE_TTL = 6 * 60 * 60 * 1000;
const baseline = new BoundedMap<string, { trusted: boolean; at: number }>(50_000);
const probeOnce = singleFlight<boolean>();

const randomPart = () => `zq${Math.random().toString(36).slice(2, 8)}x`;

function decoyFor(username: string) {
  const sep = username.match(/[._-]/);
  if (!sep?.index) return { key: "*", name: randomPart() };
  const head = username.slice(0, sep.index + 1);
  return { key: head.toLowerCase(), name: head + randomPart() };
}

async function isTrusted(site: SiteDef, username: string) {
  const decoy = decoyFor(username);
  const key = `${site.name}|${decoy.key}`;
  const cached = baseline.get(key);
  if (cached && Date.now() - cached.at < BASELINE_TTL) return cached.trusted;
  return probeOnce(key, async () => {
    const probe = await checkSite(site, decoy.name);
    const trusted = probe.state !== "found";
    if (probe.state !== "unknown") baseline.set(key, { trusted, at: Date.now() });
    return trusted;
  });
}

export type CheckSummary = { results: SiteResult[]; found: SiteResult[]; checked: number; unknown: number; untrusted: number; skipped: number };

export type CheckOptions = { concurrency?: number; budget?: number };

export async function checkSites(sites: SiteDef[], username: string, { concurrency = 32, budget }: CheckOptions = {}): Promise<CheckSummary> {
  let untrusted = 0;
  let skipped = 0;
  const deadline = budget
    ? {
        at: Date.now() + budget,
        late: (site: SiteDef): SiteResult => {
          skipped += 1;
          return { site, url: fill(site.pretty ?? site.check, accountFor(site, username)), state: "unknown", reason: "out of time" };
        },
      }
    : undefined;
  const results = await mapLimit(
    sites,
    concurrency,
    async (site) => {
      const r = await checkSite(site, username);
      if (r.state !== "found") return r;
      if (await isTrusted(site, username)) return r;
      untrusted += 1;
      return { ...r, state: "unknown" as const };
    },
    deadline,
  );
  const found = results.filter((r) => r.state === "found");
  const unknown = results.filter((r) => r.state === "unknown").length;
  return { results, found, checked: sites.length, unknown, untrusted, skipped };
}
