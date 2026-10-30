import "server-only";
import type { Finding, Removal } from "@/types/scan";
import type { Identifier } from "@/lib/identifiers";
import { config, USER_AGENT } from "@/server/config";
import { requestSignal } from "../context";
import { outbound, readBody, scanFetch } from "../net";
import { deletionGuide, fromGuide } from "../removal";

const TIMEOUT = 10_000;
const MAX_BODY = 200_000;
const enc = encodeURIComponent;

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

type Reply = { status: number; text: string; json: () => Record<string, unknown> | null };

async function call(url: string, init: { method?: string; headers?: Record<string, string>; json?: unknown; form?: Record<string, string> } = {}): Promise<Reply> {
  return outbound(url, async () => {
    const body = init.json !== undefined ? JSON.stringify(init.json) : init.form ? new URLSearchParams(init.form).toString() : undefined;
    const res = await scanFetch(url, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers: {
        "user-agent": BROWSER_UA,
        accept: "application/json, text/plain;q=0.9",
        ...(init.json !== undefined ? { "content-type": "application/json" } : init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...init.headers,
      },
      body,
      signal: requestSignal(TIMEOUT),
    });
    const text = await readBody(res, MAX_BODY);
    return {
      status: res.status,
      text,
      json: () => {
        try {
          const data: unknown = JSON.parse(text);
          return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
        } catch {
          return null;
        }
      },
    };
  });
}

type Service = { name: string; url: string; probe: (email: string) => Promise<boolean | null> };

const SERVICES: Service[] = [
  {
    name: "Spotify",
    url: "https://www.spotify.com",
    probe: async (e) => {
      const status = (await call(`https://spclient.wg.spotify.com/signup/public/v1/account?validate=1&email=${enc(e)}`)).json()?.status;
      return status === 20 ? true : status === 1 ? false : null;
    },
  },
  {
    name: "Microsoft",
    url: "https://account.microsoft.com",
    probe: async (e) => {
      const d = (await call("https://login.microsoftonline.com/common/GetCredentialType", { json: { Username: e, isOtherIdpSupported: true } })).json();
      if (!d || d.ThrottleStatus === 1) return null;
      return [0, 5, 6].includes(d.IfExistsResult as number) ? true : d.IfExistsResult === 1 ? false : null;
    },
  },
  {
    name: "Adobe",
    url: "https://account.adobe.com",
    probe: async (e) => {
      const r = await call("https://auth.services.adobe.com/signin/v2/users/accounts", { json: { username: e, usernameType: "EMAIL" }, headers: { "x-ims-clientid": "adobedotcom2" } });
      if (r.status !== 200) return null;
      try {
        const list: unknown = JSON.parse(r.text);
        return Array.isArray(list) ? list.length > 0 : null;
      } catch {
        return null;
      }
    },
  },
  {
    name: "X (Twitter)",
    url: "https://x.com",
    probe: async (e) => {
      const taken = (await call(`https://api.x.com/i/users/email_available.json?email=${enc(e)}`)).json()?.taken;
      return typeof taken === "boolean" ? taken : null;
    },
  },
  {
    name: "Snapchat",
    url: "https://www.snapchat.com",
    probe: async (e) => {
      const r = await call("https://bitmoji.api.snapchat.com/api/user/find", { json: { email: e } });
      if (r.status === 204) return false;
      return r.status === 200 && r.json()?.account_type ? true : null;
    },
  },
  {
    name: "Duolingo",
    url: "https://www.duolingo.com",
    probe: async (e) => {
      const users = (await call(`https://www.duolingo.com/2017-06-30/users?email=${enc(e)}&fields=users{id}`)).json()?.users;
      return Array.isArray(users) ? users.length > 0 : null;
    },
  },
  {
    name: "Chess.com",
    url: "https://www.chess.com",
    probe: async (e) => {
      const available = (await call(`https://www.chess.com/callback/email/available?email=${enc(e)}`)).json()?.isEmailAvailable;
      return typeof available === "boolean" ? !available : null;
    },
  },
  {
    name: "LastPass",
    url: "https://www.lastpass.com",
    probe: async (e) => {
      const r = await call(`https://lastpass.com/create_account.php?check=avail&skipcontent=1&mistype=1&username=${enc(e)}`, { headers: { accept: "text/plain" } });
      const answer = r.status === 200 ? r.text.trim() : "";
      return answer === "no" ? true : answer === "ok" ? false : null;
    },
  },
  {
    name: "WordPress.com",
    url: "https://wordpress.com",
    probe: async (e) => {
      const r = await call(`https://public-api.wordpress.com/rest/v1.1/users/${enc(e)}/auth-options`);
      const error = r.json()?.error;
      if (r.status === 404 && error === "unknown_user") return false;
      return r.status === 200 || error === "email_login_not_allowed" ? true : null;
    },
  },
  {
    name: "Freelancer",
    url: "https://www.freelancer.com",
    probe: async (e) => {
      const r = await call("https://www.freelancer.com/api/users/0.1/users/check?compact=true&new_errors=true", { json: { user: { email: e } } });
      const d = r.json();
      if (r.status === 200 && d?.status === "success") return false;
      return r.status === 409 && d?.error_code === "UserExceptionCodes.EMAIL_TAKEN" ? true : null;
    },
  },
  {
    name: "MeWe",
    url: "https://mewe.com",
    probe: async (e) => {
      const d = (await call(`https://mewe.com/api/v2/auth/checkEmail?email=${enc(e)}`)).json();
      return d?.errorCode === 109 ? true : d?.message === "ok" ? false : null;
    },
  },
];

export const EMAIL_SERVICE_COUNT = SERVICES.length;

function accountRemoval(service: Service): Removal {
  const guide = deletionGuide(service.url);
  return {
    ...fromGuide(guide),
    steps: [
      `Still use ${service.name}? Make sure it has its own password and two-factor sign-in turned on.`,
      `Don't use it any more? Delete the account, so your data there can't leak in a future breach.${guide?.notes ? ` ${guide.notes}` : ""}`,
      "Can't sign in any more? Send an erasure request. The site has to delete your data within a month under GDPR, or 45 days under CCPA.",
    ],
    letter: true,
  };
}

export async function checkEmailAccounts(identifier: Identifier): Promise<{ findings: Finding[]; checked: number; unknown: number }> {
  const results = await Promise.allSettled(SERVICES.map((s) => s.probe(identifier.value)));
  const findings: Finding[] = [];
  let unknown = 0;
  results.forEach((r, i) => {
    const service = SERVICES[i];
    if (r.status === "rejected" || r.value === null) {
      unknown += 1;
      return;
    }
    if (!r.value) return;
    findings.push({
      id: `account:${service.name}`,
      source: "profile",
      identifier,
      site: service.name,
      title: `Account on ${service.name}`,
      detail: `This email is registered with ${service.name}. Accounts you've forgotten still hold your data, and they can leak in a breach or be taken over.`,
      exposed: ["Email"],
      severity: "low",
      url: service.url,
      removal: accountRemoval(service),
    });
  });
  return { findings, checked: SERVICES.length, unknown };
}

type CommitSearch = { total_count?: number; items?: { html_url?: string; repository?: { full_name?: string } }[] };

async function githubCommits(identifier: Identifier): Promise<Finding | null> {
  const r = await call(`https://api.github.com/search/commits?q=${enc(`author-email:${identifier.value}`)}&per_page=5`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": USER_AGENT,
      ...(config.githubToken ? { authorization: `Bearer ${config.githubToken}` } : {}),
    },
  });
  if (r.status !== 200) throw new Error(`GitHub commit search returned ${r.status}`);
  const d = r.json() as CommitSearch | null;
  const total = d?.total_count ?? 0;
  if (!total) return null;
  const repos = [...new Set((d?.items ?? []).map((c) => c.repository?.full_name).filter((n): n is string => Boolean(n)))];
  return {
    id: `github-commits:${identifier.value}`,
    source: "web",
    identifier,
    site: "GitHub",
    title: `Email in ${total.toLocaleString("en-US")} public GitHub commit${total > 1 ? "s" : ""}`,
    detail: `Every public commit records its author's email, and anyone can read it from the history${repos.length ? `, for example in ${repos.slice(0, 3).join(", ")}` : ""}. Spammers and scrapers collect emails this way.`,
    exposed: ["Email", "Name"],
    severity: "medium",
    url: d?.items?.[0]?.html_url ?? `https://github.com/search?q=${enc(`author-email:${identifier.value}`)}&type=commits`,
    removal: {
      difficulty: "medium",
      url: "https://github.com/settings/emails",
      urlLabel: "GitHub email settings",
      steps: [
        'In GitHub email settings, turn on "Keep my email addresses private" and "Block command line pushes that expose my email".',
        "Set git to commit with your GitHub no-reply address: git config --global user.email <your no-reply address from that page>.",
        "Commits already pushed keep the old email. Rewriting history removes it from your own repositories, but forks and copies keep it.",
      ],
      letter: false,
    },
  };
}

async function keyServer(identifier: Identifier): Promise<Finding | null> {
  const r = await call(`https://keyserver.ubuntu.com/pks/lookup?op=index&options=mr&search=${enc(identifier.value)}`, { headers: { accept: "text/plain", "user-agent": USER_AGENT } });
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`Key server returned ${r.status}`);
  const email = identifier.value.toLowerCase();
  const names = r.text
    .split("\n")
    .filter((line) => line.startsWith("uid:"))
    .map((line) => {
      try {
        return decodeURIComponent(line.split(":")[1] ?? "");
      } catch {
        return line.split(":")[1] ?? "";
      }
    })
    .filter((uid) => uid.toLowerCase().includes(`<${email}>`))
    .map((uid) => uid.replace(/\s*<[^>]*>\s*/, "").trim())
    .filter(Boolean);
  if (!names.length && !r.text.toLowerCase().includes(`<${email}>`)) return null;
  const unique = [...new Set(names)];
  return {
    id: `pgp:${identifier.value}`,
    source: "web",
    identifier,
    site: "PGP key servers",
    title: "Email published on PGP key servers",
    detail: `A public encryption key lists this email${unique.length ? ` with the name ${unique.slice(0, 3).map((n) => `"${n}"`).join(", ")}` : ""}. Key servers copy keys between each other and keep them for good.`,
    exposed: unique.length ? ["Email", "Name"] : ["Email"],
    severity: unique.length ? "medium" : "low",
    url: `https://keyserver.ubuntu.com/pks/lookup?op=index&search=${enc(identifier.value)}`,
    removal: {
      difficulty: "hard",
      url: "https://keys.openpgp.org/manage",
      urlLabel: "Manage your key on keys.openpgp.org",
      steps: [
        "If it's your key, publish a revocation certificate so the key is marked as no longer used.",
        "keys.openpgp.org lets you remove your email from a key there. Older servers like keyserver.ubuntu.com don't delete keys.",
        "If you didn't create this key, someone else published your email. Send an erasure request to the key server's operator.",
      ],
      letter: true,
    },
  };
}

export async function checkEmailPublished(identifier: Identifier): Promise<Finding[]> {
  const results = await Promise.allSettled([githubCommits(identifier), keyServer(identifier)]);
  const findings: Finding[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value) findings.push(r.value);
    } else console.error("[noise] email publication check failed", r.reason);
  }
  return findings;
}
