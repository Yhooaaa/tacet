import "server-only";
import { KIND_LABEL, type Identifier } from "@/lib/identifiers";
import type { Finding, Severity } from "@/types/scan";
import { USER_AGENT } from "@/server/config";
import { singleFlight } from "@/server/utils/limiter";
import { outsideScan } from "../context";
import { getJson } from "../net";

const MAX_LEAKS = 40;

const HIGH = ["password", "dob", "date of birth", "ssn", "social security", "address", "passport", "credit card", "bank"];
const MEDIUM = ["phone", "name", "ip", "username", "gender", "employer", "city", "zip", "country"];

function severityOf(fields: string[], fallback: Severity): Severity {
  const text = fields.join(" ").toLowerCase();
  if (HIGH.some((w) => text.includes(w))) return "high";
  if (MEDIUM.some((w) => text.includes(w))) return "medium";
  return fields.length ? "low" : fallback;
}

export function breachKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(".")[0]
    .replace(/[^a-z0-9]/g, "");
}

type CatalogEntry = { title: string; domain: string; date: string; description: string; dataClasses: string[] };

let catalog: { at: number; byKey: Map<string, CatalogEntry> } | null = null;
const loadOnce = singleFlight<Map<string, CatalogEntry>>();

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();

const CATALOG_RETRY = 5 * 60 * 1000;

async function breachCatalog(): Promise<Map<string, CatalogEntry>> {
  if (catalog && Date.now() - catalog.at < 24 * 60 * 60 * 1000) return catalog.byKey;
  return loadOnce("catalog", () => outsideScan(loadCatalog));
}

async function loadCatalog(): Promise<Map<string, CatalogEntry>> {
  try {
    type Breach = { Name: string; Title: string; Domain: string; BreachDate: string; Description: string; DataClasses: string[] };
    const list = (await getJson<Breach[]>("HIBP catalog", "https://haveibeenpwned.com/api/v3/breaches", { headers: { "user-agent": USER_AGENT }, timeout: 20_000 })) ?? [];
    const byKey = new Map<string, CatalogEntry>();
    for (const b of list) {
      const entry = { title: b.Title, domain: b.Domain, date: b.BreachDate, description: stripHtml(b.Description), dataClasses: b.DataClasses };
      for (const key of [breachKey(b.Name), breachKey(b.Title), b.Domain ? breachKey(b.Domain) : ""]) if (key && !byKey.has(key)) byKey.set(key, entry);
    }
    catalog = { at: Date.now(), byKey };
  } catch (error) {
    console.error("[noise] breach catalog unavailable", error);
    catalog = { at: Date.now() - 24 * 60 * 60 * 1000 + CATALOG_RETRY, byKey: catalog?.byKey ?? new Map() };
  }
  return catalog.byKey;
}

type LeakCheckResponse = { success: boolean; found?: number; fields?: string[]; sources?: { name: string; date: string }[]; error?: string };

const FIELD_LABEL: Record<string, string> = {
  password: "Passwords",
  dob: "Dates of birth",
  ssn: "Social security numbers",
  phone: "Phone numbers",
  address: "Physical addresses",
  ip: "IP addresses",
  name: "Names",
  username: "Usernames",
  zip: "Postcodes",
  city: "Cities",
  country: "Countries",
  gender: "Genders",
  company_name: "Employers",
};

function fieldLabels(fields: string[]) {
  const labels = new Set<string>();
  for (const f of fields) {
    const base = f.replace(/\d+$/, "").replace(/^(first|last|middle|profile)_name$/, "name");
    if (FIELD_LABEL[base]) labels.add(FIELD_LABEL[base]);
  }
  return [...labels];
}

async function leakCheck(id: Identifier): Promise<Finding[]> {
  const query = id.kind === "phone" ? id.value.replace(/^\+/, "") : id.value;
  const data = await getJson<LeakCheckResponse>("LeakCheck", `https://leakcheck.io/api/public?check=${encodeURIComponent(query)}`, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!data?.success || !data.sources?.length) return [];

  const known = await breachCatalog();
  const allFields = fieldLabels(data.fields ?? []);
  const label = KIND_LABEL[id.kind].toLowerCase();
  const sources = [...data.sources].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, MAX_LEAKS);

  return sources.map((s) => {
    const entry = known.get(breachKey(s.name));
    const stealer = /stealer/i.test(s.name);
    const exposed = entry?.dataClasses ?? [KIND_LABEL[id.kind], ...(stealer ? ["Saved passwords"] : [])];
    const detail = entry
      ? entry.description
      : stealer
        ? `This ${label} appears in infostealer logs: data copied off an infected computer, usually including saved passwords.`
        : `This ${label} appears in the ${s.name} leak, which is circulating publicly.${allFields.length ? ` Across every leak with this ${label}, the exposed data includes: ${allFields.join(", ").toLowerCase()}.` : ""}`;
    return {
      id: `breach:${breachKey(entry?.title ?? s.name)}`,
      source: "breach" as const,
      identifier: id,
      site: entry?.title ?? s.name,
      title: stealer ? "Found in infostealer logs" : `Found in the ${entry?.title ?? s.name} leak`,
      detail: `${detail}${id.kind === "username" ? "\nUsernames aren't unique: check this was your account before acting on it." : ""}\n(listed by LeakCheck)`,
      exposed,
      severity: stealer ? "high" : severityOf(entry?.dataClasses ?? [], id.kind === "username" ? "low" : "medium"),
      url: entry?.domain ? `https://${entry.domain}` : /\.[a-z]{2,}$/i.test(s.name) ? `https://${s.name.toLowerCase()}` : undefined,
      date: s.date ? s.date.slice(0, 4) : entry?.date?.slice(0, 4),
    };
  });
}

type Stealer = { date_compromised?: string; computer_name?: string; operating_system?: string; total_user_services?: number; total_corporate_services?: number };

async function hudsonRock(id: Identifier): Promise<Finding[]> {
  if (id.kind === "phone") return [];
  const by = id.kind === "email" ? `search-by-email?email=` : `search-by-username?username=`;
  const data = await getJson<{ stealers?: Stealer[] }>("Hudson Rock", `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/${by}${encodeURIComponent(id.value)}`, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  const stealers = (data?.stealers ?? []).filter((s) => s.date_compromised);
  if (!stealers.length) return [];

  const latest = [...stealers].sort((a, b) => (b.date_compromised ?? "").localeCompare(a.date_compromised ?? ""))[0];
  const when = new Date(latest.date_compromised!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const logins = stealers.reduce((n, s) => n + (s.total_user_services ?? 0) + (s.total_corporate_services ?? 0), 0);
  const device = [latest.computer_name, latest.operating_system].filter(Boolean).join(", ");
  const label = KIND_LABEL[id.kind].toLowerCase();

  return [
    {
      id: `stealer:${id.kind}:${id.value}`,
      source: "breach",
      identifier: id,
      site: "Infostealer logs",
      title: stealers.length > 1 ? `Found on ${stealers.length} computers infected with password-stealing malware` : "Found on a computer infected with password-stealing malware",
      detail: [
        `This ${label} was used on a computer infected with infostealer malware, most recently on ${when}. The malware copies every password, cookie and login saved in the browser, and the logs are sold among criminals.`,
        device ? `Infected device: ${device}.` : null,
        logins ? `Logins taken from ${stealers.length > 1 ? "these devices" : "this device"}: ${logins}.` : null,
        "(listed by Hudson Rock)",
      ]
        .filter(Boolean)
        .join("\n"),
      exposed: ["Saved passwords", "Browser cookies", "Logins"],
      severity: "high",
      date: latest.date_compromised!.slice(0, 10),
      removal: {
        difficulty: "hard",
        steps: [
          "Clean the infected device first: run a full antivirus scan, or better, reinstall the operating system. Changing passwords on an infected computer just hands over the new ones.",
          "From a clean device, change the password of every account that was saved in that browser, starting with email, banking and work accounts.",
          "Sign out of all sessions on those accounts. Stolen cookies let attackers in without a password.",
          "Turn on two-factor authentication everywhere it's offered.",
        ],
        letter: false,
      },
    },
  ];
}

export async function checkOpenLeaks(id: Identifier): Promise<{ findings: Finding[]; failed: number; sources: number }> {
  const jobs = [leakCheck(id), hudsonRock(id)];
  const results = await Promise.allSettled(jobs);
  const findings: Finding[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") findings.push(...r.value);
    else {
      failed += 1;
      console.error("[noise] leak index failed", r.reason);
    }
  }
  return { findings, failed, sources: jobs.length };
}
