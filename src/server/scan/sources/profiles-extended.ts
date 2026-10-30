import "server-only";
import type { Finding, Severity } from "@/types/scan";
import type { Identifier } from "@/lib/identifiers";
import { USERNAME_SITES } from "./profiles";
import { checkSites, type CodeSpec, type SiteDef, type SiteResult } from "./site-check";
import wmn from "../data/wmn-data.json";
import maigret from "../data/maigret-data.json";

const CUSTOM: SiteDef[] = [
  { name: "LinkedIn", check: "https://www.linkedin.com/in/{account}", found: { code: 200 }, missing: { code: 404 }, category: "business" },
  { name: "GitBook", check: "https://{account}.gitbook.io", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "Tilda", check: "https://{account}.tilda.ws", found: { code: 200 }, missing: { code: 404 }, category: "blog" },
  { name: "Readme", check: "https://{account}.readme.io", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "Surge.sh", check: "https://{account}.surge.sh", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "Netlify", check: "https://{account}.netlify.app", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "Vercel", check: "https://{account}.vercel.app", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "Heroku", check: "https://{account}.herokuapp.com", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "Exercism", check: "https://exercism.org/profiles/{account}", found: { code: 200 }, missing: { code: 404 }, category: "coding" },
  { name: "CSDN", check: "https://blog.csdn.net/{account}", found: { code: 200 }, missing: { code: 404 }, category: "blog" },
  { name: "Issuu", check: "https://issuu.com/{account}", found: { code: 200 }, missing: { code: 404 }, category: "news" },
  { name: "Archive of Our Own", check: "https://archiveofourown.org/users/{account}", found: { code: 200 }, missing: { code: 404 }, category: "hobby" },
  { name: "Goodreads", check: "https://www.goodreads.com/{account}", found: { code: 200 }, missing: { code: 404 }, category: "hobby" },
  {
    name: "Audiomack",
    check: "https://audiomack.com/{account}",
    found: { code: 200, without: "Audiomack - Music platform empowering" },
    missing: { code: 200, text: "Audiomack - Music platform empowering" },
    category: "music",
  },
  { name: "ReverbNation", check: "https://www.reverbnation.com/{account}", found: { code: 200 }, missing: { code: 404 }, category: "music" },
  { name: "Slack workspace", check: "https://{account}.slack.com", found: { code: [200, 403] }, missing: { code: 404 }, category: "business" },
  { name: "Mattermost Cloud", check: "https://{account}.mattermost.com", found: { code: 200 }, missing: { code: 404 }, category: "business" },
  { name: "Zulip", check: "https://{account}.zulipchat.com", found: { code: 200 }, missing: { code: 404 }, category: "social" },
  {
    name: "Matrix",
    check: "https://matrix-client.matrix.org/_matrix/client/v3/profile/@{account}:matrix.org",
    pretty: "https://matrix.to/#/@{account}:matrix.org",
    found: { code: 200 },
    missing: { code: 404 },
    category: "social",
  },
  {
    name: "Jami",
    check: "https://ns.jami.net/name/{account}",
    found: { code: 200, text: '"address"' },
    missing: { code: 404 },
    category: "social",
  },
];

type WmnSite = {
  name: string;
  uri_check: string;
  uri_pretty?: string;
  post_body?: string;
  headers?: Record<string, string>;
  e_code: number;
  e_string: string;
  m_code: number;
  m_string: string;
  strip_bad_char?: string;
  cat: string;
  valid?: boolean;
};

const WMN: SiteDef[] = (wmn.sites as WmnSite[])
  .filter((s) => s.valid !== false)
  .map((s) => ({
    name: s.name,
    check: s.uri_check,
    pretty: s.uri_pretty,
    body: s.post_body,
    headers: s.headers,
    strip: s.strip_bad_char,
    category: s.cat,
    found: { code: s.e_code, text: s.e_string || undefined },
    missing: { code: s.m_code, text: s.m_string || undefined },
  }));

type MaigretSite = {
  name: string;
  url: string;
  checkType: "status_code" | "message" | "response_url";
  probe?: string;
  present?: string[];
  absent?: string[];
  errors?: string[];
  headers?: Record<string, string>;
  pattern?: string;
  method?: "POST" | "HEAD";
  payload?: string;
  ignore403?: boolean;
  tags?: string[];
  rank?: number;
};

const MAIGRET_CATEGORY: Record<string, string> = {
  porn: "xx NSFW xx",
  erotic: "xx NSFW xx",
  dating: "dating",
  medicine: "health",
  religion: "religion",
  finance: "finance",
  crypto: "finance",
  gambling: "finance",
};

const REDIRECTS = [301, 302, 303, 307, 308];

function fromMaigret(s: MaigretSite): SiteDef {
  const success: CodeSpec[] = s.ignore403 ? ["2xx", 403] : ["2xx"];
  const base = {
    name: s.name,
    check: s.probe ?? s.url,
    pretty: s.url,
    method: s.method,
    body: s.payload,
    headers: s.payload ? { "content-type": "application/json", ...s.headers } : s.headers,
    errors: s.errors,
    pattern: s.pattern,
    category: s.tags?.map((t) => MAIGRET_CATEGORY[t]).find(Boolean) ?? s.tags?.[0],
  };
  if (s.checkType === "message") {
    return {
      ...base,
      found: { code: success, text: s.present, without: s.absent },
      missing: [...(s.absent ? [{ code: "any" as const, text: s.absent }] : []), { code: [404, 410] }],
    };
  }
  if (s.checkType === "response_url") {
    return { ...base, noRedirect: true, found: { code: "2xx", text: s.present, without: s.absent }, missing: { code: [...REDIRECTS, 404, 410] } };
  }
  return { ...base, found: { code: "2xx", text: s.present, without: s.absent }, missing: { code: [...REDIRECTS, 400, 404, 410] } };
}

const MAIGRET_SKIP = new Set(["HudsonRock"]);

const MAIGRET: SiteDef[] = (maigret.sites as MaigretSite[]).filter((s) => !MAIGRET_SKIP.has(s.name)).map(fromMaigret);

const normName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const normUrl = (url: string) =>
  url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/+$/, "");

function dedupe(lists: SiteDef[][]) {
  const names = new Set(USERNAME_SITES.map((s) => normName(s.name)));
  const urls = new Set(USERNAME_SITES.map((s) => normUrl(s.profile)));
  const out: SiteDef[] = [];
  for (const site of lists.flat()) {
    const name = normName(site.name);
    const url = normUrl(site.pretty ?? site.check);
    if (names.has(name) || urls.has(url)) continue;
    names.add(name);
    urls.add(url);
    out.push(site);
  }
  return out;
}

const SITES = dedupe([CUSTOM, WMN, MAIGRET]);

export const USERNAME_SITE_COUNT = SITES.length;

const CONCURRENCY = 128;
const BUDGET = 60_000;

const SENSITIVE: Record<string, string> = {
  "xx NSFW xx": "an adult site",
  dating: "a dating site",
  health: "a health site",
  political: "a political site",
  religion: "a religious site",
  finance: "a finance site",
};

function toFinding(identifier: Identifier, r: SiteResult): Finding {
  const sensitive = r.site.category ? SENSITIVE[r.site.category] : undefined;
  const severity: Severity = sensitive ? "medium" : "low";
  const lines = [
    sensitive ? `An account with this username exists on ${sensitive}.` : "Public profile with the same username.",
    r.title ? `Page title: ${r.title.length > 120 ? `${r.title.slice(0, 117)}...` : r.title}` : null,
  ].filter(Boolean);
  return {
    id: `profile:${identifier.value}:${r.site.name}`,
    source: "profile",
    identifier,
    site: r.site.name,
    title: `Public ${r.site.name} profile`,
    detail: lines.join("\n"),
    exposed: sensitive ? ["Username", "Sensitive account"] : ["Username"],
    severity,
    url: r.url,
  };
}

export async function checkUsernameExtended(identifier: Identifier): Promise<{ findings: Finding[]; checked: number; unknown: number; skipped: number }> {
  const { found, checked, unknown, untrusted, skipped } = await checkSites(SITES, identifier.value, { concurrency: CONCURRENCY, budget: BUDGET });
  if (untrusted) console.info(`[noise] ignored ${untrusted} hit(s) from sites that also accept a look-alike name`);
  if (skipped) console.info(`[noise] ran out of time before ${skipped} site(s)`);
  return { findings: found.map((r) => toFinding(identifier, r)), checked, unknown, skipped };
}
