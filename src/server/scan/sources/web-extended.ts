import "server-only";
import type { Identifier } from "@/lib/identifiers";
import { phoneQuery } from "@/lib/phone";
import { mentionsIdentifier } from "./mentions";
import type { Finding } from "@/types/scan";
import { USER_AGENT } from "@/server/config";
import { mapLimit } from "./site-check";
import { requestSignal } from "../context";
import { outbound, scanFetch } from "../net";

const TIMEOUT = 12000;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function getText(url: string, ua = BROWSER_UA): Promise<string | null> {
  try {
    return await outbound(url, async () => {
      const res = await scanFetch(url, {
        headers: { "user-agent": ua, accept: "text/html,application/json,*/*", "accept-language": "en-US,en;q=0.9" },
        signal: requestSignal(TIMEOUT),
      });
      if (!res.ok) {
        await res.body?.cancel();
        return null;
      }
      return await res.text();
    });
  } catch {
    return null;
  }
}

function queryFor({ kind, value }: Identifier): string {
  if (kind === "phone") {
    return phoneQuery(value);
  }
  return `"${value}"`;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const plain = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

type Result = { url: string; title: string; snippet: string };

export function unwrapUrl(href: string): string | null {
  try {
    const url = new URL(decodeEntities(href), "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return uddg;
    if (url.hostname.endsWith("bing.com") && url.pathname === "/ck/a") {
      const u = url.searchParams.get("u");
      if (!u?.startsWith("a1")) return null;
      return Buffer.from(u.slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    }
    if (url.hostname.includes("google.") && url.pathname === "/url") return url.searchParams.get("q") ?? url.searchParams.get("url");
    if (url.hostname.includes("yandex.") && url.searchParams.get("url")) return url.searchParams.get("url");
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseBlocks(html: string, splitter: RegExp, linkRe: RegExp): Result[] {
  const out: Result[] = [];
  for (const block of html.split(splitter).slice(1)) {
    const link = block.match(linkRe);
    if (!link) continue;
    const url = unwrapUrl(link[1]);
    if (!url) continue;
    const title = plain(link[2]);
    let snippet = plain(block.replace(/^[^<>]*>/, "")).replace(/\b\d{4}-\d{2}-\d{2}T[\d:.]+Z?\b/g, "").replace(/\s+/g, " ").trim();
    if (title && snippet.startsWith(title)) snippet = snippet.slice(title.length).trim();
    out.push({ url, title, snippet: snippet.slice(0, 400) });
  }
  return out;
}

const ENGINES: { name: string; url: (q: string) => string; parse: (html: string) => Result[] }[] = [
  {
    name: "DuckDuckGo",
    url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    parse: (html) => parseBlocks(html, /<div class="result results_links/, /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/),
  },
  {
    name: "Bing",
    url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en&cc=US`,
    parse: (html) => parseBlocks(html, /<li class="b_algo"/, /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/),
  },
  ...["https://searx.be", "https://search.inetol.net", "https://searx.tiekoetter.com", "https://searxng.site", "https://opnxng.com"].map((inst) => ({
    name: `SearXNG (${new URL(inst).hostname})`,
    url: (q: string) => `${inst}/search?q=${encodeURIComponent(q)}&language=all`,
    parse: (html: string) => parseBlocks(html, /<article class="result/, /<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/),
  })),
];

const ENGINE_HOSTS = /(^|\.)(duckduckgo\.com|bing\.com|microsoft\.com|msn\.com|searx\.be|inetol\.net|tiekoetter\.com|searxng\.site|opnxng\.com)$/;

function toWebFinding(id: Identifier, r: Result, via: string): Finding | null {
  let host: string;
  try {
    host = new URL(r.url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (ENGINE_HOSTS.test(host)) return null;
  if (!mentionsIdentifier(id, r.title, r.snippet, decodeURIComponent(r.url))) return null;
  return {
    id: `web:${r.url}`,
    source: "web",
    identifier: id,
    site: host,
    title: r.title || `Mentioned on ${host}`,
    detail: `${r.snippet.slice(0, 280)}${r.snippet.length > 280 ? "..." : ""}\n(found via ${via})`,
    exposed: id.kind === "phone" ? ["Phone number"] : id.kind === "email" ? ["Email"] : ["Username"],
    severity: id.kind === "username" ? "low" : "medium",
    url: r.url,
  };
}

async function searchEngines(id: Identifier): Promise<Finding[]> {
  const q = queryFor(id);
  const searx = ENGINES.filter((e) => e.name.startsWith("SearXNG"));
  const direct = ENGINES.filter((e) => !e.name.startsWith("SearXNG"));
  const run = async (engine: (typeof ENGINES)[number]) => {
    const html = await getText(engine.url(q));
    if (!html) return null;
    return engine.parse(html).map((r) => toWebFinding(id, r, engine.name)).filter((f): f is Finding => Boolean(f));
  };
  const viaSearx = (async () => {
    for (const engine of searx) {
      const r = await run(engine);
      if (r) return r;
    }
    return [];
  })();
  const results = await Promise.all([...direct.map(run), viaSearx]);
  return results.flatMap((r) => r ?? []);
}

const ARCHIVED_PROFILES = [
  "github.com/{u}",
  "twitter.com/{u}",
  "x.com/{u}",
  "instagram.com/{u}",
  "facebook.com/{u}",
  "reddit.com/user/{u}",
  "youtube.com/@{u}",
  "youtube.com/user/{u}",
  "tiktok.com/@{u}",
  "t.me/{u}",
  "vk.com/{u}",
  "linkedin.com/in/{u}",
  "medium.com/@{u}",
  "pinterest.com/{u}",
  "twitch.tv/{u}",
  "soundcloud.com/{u}",
  "steamcommunity.com/id/{u}",
  "deviantart.com/{u}",
  "flickr.com/photos/{u}",
  "{u}.tumblr.com",
  "{u}.livejournal.com",
  "myspace.com/{u}",
  "ok.ru/{u}",
  "last.fm/user/{u}",
  "about.me/{u}",
  "keybase.io/{u}",
];

type Snapshots = { first: string; last: string; count: number; url: string };

async function wayback(target: string): Promise<Snapshots | null> {
  const text = await getText(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&fl=timestamp,original&filter=statuscode:200&collapse=timestamp:4`,
    USER_AGENT,
  );
  if (!text) return null;
  try {
    const rows = (JSON.parse(text) as string[][]).slice(1);
    if (!rows.length) return null;
    const [first, last] = [rows[0], rows[rows.length - 1]];
    return { first: first[0], last: last[0], count: rows.length, url: `https://web.archive.org/web/${last[0]}/${last[1]}` };
  } catch {
    return null;
  }
}

async function archiveToday(target: string): Promise<Snapshots | null> {
  const text = await getText(`https://archive.ph/timemap/https://${target}`, USER_AGENT);
  if (!text) return null;
  const mementos = [...text.matchAll(/<(https?:\/\/archive\.[a-z]+\/(\d{14})\/[^>]+)>;\s*rel="[^"]*memento/g)];
  if (!mementos.length) return null;
  const first = mementos[0];
  const last = mementos[mementos.length - 1];
  return { first: first[2], last: last[2], count: mementos.length, url: last[1].replace(/^http:/, "https:") };
}

const year = (ts: string) => ts.slice(0, 4);

function archiveFinding(id: Identifier, target: string, archive: string, s: Snapshots, unit: string): Finding {
  const host = target.split("/")[0].replace(`${id.value}.`, "");
  const span = year(s.first) === year(s.last) ? `in ${year(s.first)}` : `between ${year(s.first)} and ${year(s.last)}`;
  return {
    id: `archive:${archive}:${target}`,
    source: "web",
    identifier: id,
    site: `${host} (${archive})`,
    title: `Archived copy of ${target}`,
    detail: `${archive} holds ${s.count} ${unit}${s.count > 1 ? "s" : ""} of this page, saved ${span}. Archived copies stay public even after the original is changed or deleted.`,
    exposed: ["Username", "Archived page"],
    severity: "low",
    url: s.url,
    date: `${year(s.last)}-${s.last.slice(4, 6)}-${s.last.slice(6, 8)}`,
  };
}

const ARCHIVE_BUDGET = 45_000;

async function searchArchives(id: Identifier): Promise<Finding[]> {
  if (id.kind !== "username") return [];
  const targets = ARCHIVED_PROFILES.map((t) => t.replace("{u}", id.value));
  const found = await mapLimit(
    targets,
    4,
    async (target) => {
      const [wb, at] = await Promise.all([wayback(target), archiveToday(target)]);
      const out: Finding[] = [];
      if (wb) out.push(archiveFinding(id, target, "Wayback Machine", wb, "yearly snapshot"));
      if (at) out.push(archiveFinding(id, target, "archive.today", at, "capture"));
      return out;
    },
    { at: Date.now() + ARCHIVE_BUDGET, late: () => [] },
  );
  return found.flat();
}

export async function searchWebExtended(identifier: Identifier): Promise<Finding[]> {
  const results = await Promise.allSettled([searchEngines(identifier), searchArchives(identifier)]);
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.error("[noise] web source failed", r.reason);
      continue;
    }
    for (const f of r.value) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      findings.push(f);
    }
  }
  return findings.slice(0, 60);
}
