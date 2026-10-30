import "server-only";
import { createHash } from "node:crypto";
import type { Finding, Severity } from "@/types/scan";
import type { Identifier } from "@/lib/identifiers";
import { config, USER_AGENT } from "@/server/config";
import { requestSignal } from "../context";
import { outbound, readBody, scanFetch } from "../net";

type Probe = { exists: boolean; fields?: Record<string, string | null | undefined>; links?: (string | null | undefined)[] } | null;

type Site = {
  name: string;
  profile: (u: string) => string;
  probe: (u: string) => Promise<Probe>;
};

const TIMEOUT = 8000;
const MAX_BODY = 1_500_000;

type Fetched = { status: number; ok: boolean; text: () => Promise<string>; json: () => Promise<unknown>; body: null };

async function get(url: string, init: RequestInit = {}, withBody = true): Promise<Fetched> {
  return outbound(url, async () => {
    const res = await scanFetch(url, {
      redirect: "manual",
      ...init,
      headers: { "user-agent": USER_AGENT, accept: "application/json, text/html;q=0.9", ...init.headers },
      signal: requestSignal(TIMEOUT),
    });
    let text = "";
    if (res.ok && withBody) text = await readBody(res, MAX_BODY);
    else await res.body?.cancel().catch(() => {});
    return { status: res.status, ok: res.ok, text: async () => text, json: async () => JSON.parse(text), body: null };
  });
}

function byStatus(url: (u: string) => string, taken = [200], free = [404]) {
  return async (u: string): Promise<Probe> => {
    const res = await get(url(u), {}, false);
    if (taken.includes(res.status)) return { exists: true };
    if (free.includes(res.status)) return { exists: false };
    return null;
  };
}

function byJson<T>(
  url: (u: string) => string,
  read: (data: T) => Probe,
  free = [404],
  init?: RequestInit,
) {
  return async (u: string): Promise<Probe> => {
    const res = await get(url(u), init);
    if (free.includes(res.status)) return { exists: false };
    if (!res.ok) return null;
    return read((await res.json()) as T);
  };
}

const enc = encodeURIComponent;
const fullName = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ") || undefined;

const SITES: Site[] = [
  {
    name: "GitHub",
    profile: (u) => `https://github.com/${u}`,
    probe: byJson<{ name?: string; location?: string; company?: string; blog?: string; email?: string; bio?: string; twitter_username?: string }>(
      (u) => `https://api.github.com/users/${enc(u)}`,
      (d) => ({
        exists: true,
        fields: { Name: d.name, Location: d.location, Employer: d.company, Website: d.blog, Email: d.email, Bio: d.bio },
        links: [d.blog, d.email, d.twitter_username && `x.com/${d.twitter_username}`],
      }),
      [404],
      config.githubToken ? { headers: { authorization: `Bearer ${config.githubToken}` } } : undefined,
    ),
  },
  {
    name: "GitLab",
    profile: (u) => `https://gitlab.com/${u}`,
    probe: byJson<{ name?: string }[]>(
      (u) => `https://gitlab.com/api/v4/users?username=${enc(u)}`,
      (d) => (d.length ? { exists: true, fields: { Name: d[0].name } } : { exists: false }),
    ),
  },
  {
    name: "Keybase",
    profile: (u) => `https://keybase.io/${u}`,
    probe: byJson<{ them?: ({ profile?: { full_name?: string; location?: string; bio?: string }; proofs_summary?: { all?: { proof_type: string; nametag: string }[] } } | null)[] }>(
      (u) => `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${enc(u)}`,
      (d) => {
        const user = d.them?.[0];
        if (!user) return { exists: false };
        const proofs = user.proofs_summary?.all ?? [];
        return {
          exists: true,
          fields: {
            Name: user.profile?.full_name,
            Location: user.profile?.location,
            Bio: user.profile?.bio,
            "Linked accounts": proofs.length ? proofs.map((p) => `${p.proof_type}: ${p.nametag}`).join(", ") : undefined,
          },
          links: proofs.map((p) => `${p.proof_type}:${p.nametag}`),
        };
      },
    ),
  },
  {
    name: "Hacker News",
    profile: (u) => `https://news.ycombinator.com/user?id=${u}`,
    probe: byJson<{ about?: string } | null>(
      (u) => `https://hacker-news.firebaseio.com/v0/user/${enc(u)}.json`,
      (d) => (d ? { exists: true, fields: { Bio: d.about?.replace(/<[^>]+>/g, " ").slice(0, 160) } } : { exists: false }),
    ),
  },
  {
    name: "Docker Hub",
    profile: (u) => `https://hub.docker.com/u/${u}`,
    probe: byJson<{ full_name?: string; location?: string; company?: string }>(
      (u) => `https://hub.docker.com/v2/users/${enc(u)}/`,
      (d) => ({ exists: true, fields: { Name: d.full_name, Location: d.location, Employer: d.company } }),
    ),
  },
  {
    name: "Codeberg",
    profile: (u) => `https://codeberg.org/${u}`,
    probe: byJson<{ full_name?: string; location?: string; website?: string }>(
      (u) => `https://codeberg.org/api/v1/users/${enc(u)}`,
      (d) => ({ exists: true, fields: { Name: d.full_name, Location: d.location, Website: d.website }, links: [d.website] }),
    ),
  },
  {
    name: "Bitbucket",
    profile: (u) => `https://bitbucket.org/${u}`,
    probe: byJson<{ name?: string }>(
      (u) => `https://api.bitbucket.org/2.0/workspaces/${enc(u)}`,
      (d) => ({ exists: true, fields: { Name: d.name } }),
    ),
  },
  {
    name: "Hugging Face",
    profile: (u) => `https://huggingface.co/${u}`,
    probe: byJson<{ fullname?: string }>(
      (u) => `https://huggingface.co/api/users/${enc(u)}/overview`,
      (d) => ({ exists: true, fields: { Name: d.fullname } }),
    ),
  },
  {
    name: "Bluesky",
    profile: (u) => `https://bsky.app/profile/${u}.bsky.social`,
    probe: byJson<{ displayName?: string; description?: string }>(
      (u) => `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${enc(u)}.bsky.social`,
      (d) => ({ exists: true, fields: { Name: d.displayName, Bio: d.description } }),
      [400, 404],
    ),
  },
  {
    name: "Mastodon",
    profile: (u) => `https://mastodon.social/@${u}`,
    probe: byJson<{ display_name?: string; note?: string; fields?: { name: string; value: string }[] }>(
      (u) => `https://mastodon.social/api/v1/accounts/lookup?acct=${enc(u)}`,
      (d) => ({
        exists: true,
        fields: { Name: d.display_name, Bio: d.note?.replace(/<[^>]+>/g, " ").trim() },
        links: (d.fields ?? []).map((f) => f.value.replace(/<[^>]+>/g, "")),
      }),
    ),
  },
  {
    name: "Chess.com",
    profile: (u) => `https://www.chess.com/member/${u}`,
    probe: byJson<{ name?: string; location?: string }>(
      (u) => `https://api.chess.com/pub/player/${enc(u.toLowerCase())}`,
      (d) => ({ exists: true, fields: { Name: d.name, Location: d.location } }),
    ),
  },
  {
    name: "Lichess",
    profile: (u) => `https://lichess.org/@/${u}`,
    probe: byJson<{ profile?: { realName?: string; firstName?: string; lastName?: string; location?: string; bio?: string; links?: string } }>(
      (u) => `https://lichess.org/api/user/${enc(u)}`,
      (d) => ({
        exists: true,
        fields: {
          Name: d.profile?.realName ?? fullName(d.profile?.firstName, d.profile?.lastName),
          Location: d.profile?.location,
          Bio: d.profile?.bio,
        },
        links: d.profile?.links?.split(/\s+/),
      }),
    ),
  },
  {
    name: "Codeforces",
    profile: (u) => `https://codeforces.com/profile/${u}`,
    probe: byJson<{ status: string; result?: { firstName?: string; lastName?: string; city?: string; country?: string; organization?: string }[] }>(
      (u) => `https://codeforces.com/api/user.info?handles=${enc(u)}`,
      (d) => {
        const r = d.result?.[0];
        if (d.status !== "OK" || !r) return { exists: false };
        return { exists: true, fields: { Name: fullName(r.firstName, r.lastName), Location: fullName(r.city, r.country), Employer: r.organization } };
      },
      [400],
    ),
  },
  {
    name: "Dev.to",
    profile: (u) => `https://dev.to/${u}`,
    probe: byJson<{ name?: string; location?: string; github_username?: string; twitter_username?: string; website_url?: string }>(
      (u) => `https://dev.to/api/users/by_username?url=${enc(u)}`,
      (d) => ({
        exists: true,
        fields: { Name: d.name, Location: d.location, Website: d.website_url },
        links: [d.github_username && `github.com/${d.github_username}`, d.twitter_username && `x.com/${d.twitter_username}`, d.website_url],
      }),
    ),
  },
  {
    name: "Steam",
    profile: (u) => `https://steamcommunity.com/id/${u}`,
    probe: async (u) => {
      const res = await get(`https://steamcommunity.com/id/${enc(u)}/?xml=1`);
      if (!res.ok) return null;
      const xml = await res.text();
      if (!xml.includes("<steamID64>")) return { exists: false };
      const pick = (tag: string) => xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*)\\]\\]></${tag}>`))?.[1];
      return { exists: true, fields: { Name: pick("realname"), Location: pick("location") } };
    },
  },
  {
    name: "Minecraft",
    profile: (u) => `https://namemc.com/profile/${u}`,
    probe: byStatus((u) => `https://api.mojang.com/users/profiles/minecraft/${enc(u)}`, [200], [204, 404]),
  },
  {
    name: "Telegram",
    profile: (u) => `https://t.me/${u}`,
    probe: async (u) => {
      const res = await get(`https://t.me/${enc(u)}`);
      if (!res.ok) return null;
      const html = await res.text();
      if (!html.includes("tgme_page_title")) return { exists: false };
      const title = html.match(/tgme_page_title[^>]*>\s*<span[^>]*>([^<]+)/)?.[1]?.trim();
      return { exists: true, fields: { Name: title } };
    },
  },
  {
    name: "Twitch",
    profile: (u) => `https://www.twitch.tv/${u}`,
    probe: async (u) => {
      const res = await get(`https://www.twitch.tv/${enc(u)}`);
      if (!res.ok) return null;
      const html = (await res.text()).slice(0, 4000).toLowerCase();
      return { exists: html.includes(`<title>${u.toLowerCase()} - twitch</title>`) };
    },
  },
  {
    name: "Kaggle",
    profile: (u) => `https://www.kaggle.com/${u}`,
    probe: async (u) => {
      const res = await get(`https://www.kaggle.com/${enc(u)}`);
      if (res.status === 404) return { exists: false };
      if (!res.ok) return null;
      const name = (await res.text()).match(/<title>([^<|]+)\s*\|\s*Kaggle<\/title>/)?.[1]?.trim();
      return { exists: true, fields: { Name: name } };
    },
  },
  {
    name: "Wikipedia",
    profile: (u) => `https://en.wikipedia.org/wiki/User:${u}`,
    probe: byJson<{ query?: { users?: { missing?: string }[] } }>(
      (u) => `https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=${enc(u)}&format=json`,
      (d) => ({ exists: Boolean(d.query?.users?.[0] && !("missing" in d.query.users[0])) }),
    ),
  },
  { name: "Replit", profile: (u) => `https://replit.com/@${u}`, probe: byStatus((u) => `https://replit.com/@${enc(u)}`, [200, 302]) },
  { name: "SoundCloud", profile: (u) => `https://soundcloud.com/${u}`, probe: byStatus((u) => `https://soundcloud.com/${enc(u)}`) },
  { name: "Pastebin", profile: (u) => `https://pastebin.com/u/${u}`, probe: byStatus((u) => `https://pastebin.com/u/${enc(u)}`) },
  { name: "SourceForge", profile: (u) => `https://sourceforge.net/u/${u}/profile`, probe: byStatus((u) => `https://sourceforge.net/u/${enc(u)}/profile`) },
  {
    name: "Speedrun.com",
    profile: (u) => `https://www.speedrun.com/users/${u}`,
    probe: byJson<{ data?: { location?: { country?: { names?: { international?: string } } } } }>(
      (u) => `https://www.speedrun.com/api/v1/users/${enc(u)}`,
      (d) => ({ exists: true, fields: { Location: d.data?.location?.country?.names?.international } }),
    ),
  },
];

export const USERNAME_SITE_COUNT = SITES.length;

export const USERNAME_SITES = SITES.map((s) => ({ name: s.name, profile: s.profile("{account}") }));

function severityOf(exposed: string[]): Severity {
  return exposed.some((k) => ["Email", "Name", "Location", "Linked accounts"].includes(k)) ? "medium" : "low";
}

function toFinding(identifier: Identifier, site: string, url: string, probe: NonNullable<Probe>, prefix: string): Finding {
  const fields = Object.entries(probe.fields ?? {}).filter((e): e is [string, string] => Boolean(e[1]?.trim()));
  const exposed = fields.map(([k]) => k);
  const detail = fields.length
    ? fields.map(([k, v]) => `${k}: ${v.length > 120 ? `${v.slice(0, 117)}...` : v}`).join("\n")
    : "Public profile with the same username. It shows little personal data, but it ties this username to the account.";
  return {
    id: `${prefix}:${site}`,
    source: "profile",
    identifier,
    site,
    title: `Public ${site} profile`,
    detail,
    exposed: exposed.length ? exposed : ["Username"],
    severity: severityOf(exposed),
    url,
    links: (probe.links ?? []).filter((l): l is string => Boolean(l?.trim())),
  };
}

export async function checkUsername(identifier: Identifier): Promise<{ findings: Finding[]; checked: number; unknown: number }> {
  const u = identifier.value;
  const results = await Promise.allSettled(SITES.map((site) => site.probe(u)));
  const findings: Finding[] = [];
  let unknown = 0;
  results.forEach((r, i) => {
    const site = SITES[i];
    if (r.status === "rejected" || r.value === null) {
      unknown += 1;
      return;
    }
    if (r.value.exists) findings.push(toFinding(identifier, site.name, site.profile(u), r.value, `profile:${u}`));
  });
  return { findings, checked: SITES.length, unknown };
}

type GravatarProfile = {
  display_name?: string;
  profile_url?: string;
  location?: string;
  description?: string;
  job_title?: string;
  company?: string;
  verified_accounts?: { service_label: string; url: string }[];
};

export async function checkGravatar(identifier: Identifier): Promise<Finding | null> {
  const hash = createHash("sha256").update(identifier.value.trim().toLowerCase()).digest("hex");
  const url = `https://api.gravatar.com/v3/profiles/${hash}`;
  const res = await get(url);
  if (!res.ok) return null;
  const d = (await res.json()) as GravatarProfile;
  const accounts = d.verified_accounts ?? [];
  return toFinding(
    identifier,
    "Gravatar",
    d.profile_url ?? "https://gravatar.com",
    {
      exists: true,
      fields: {
        Name: d.display_name,
        Location: d.location,
        Employer: fullName(d.job_title, d.company && `at ${d.company}`),
        Bio: d.description,
        "Linked accounts": accounts.length ? accounts.map((a) => a.service_label).join(", ") : undefined,
      },
      links: accounts.map((a) => a.url),
    },
    `gravatar:${identifier.value}`,
  );
}
