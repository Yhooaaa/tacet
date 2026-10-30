import "server-only";
import type { Finding, Severity } from "@/types/scan";
import type { Identifier } from "@/lib/identifiers";
import { config, USER_AGENT } from "@/server/config";
import { breachKey } from "./leaks";
import { getJson } from "../net";

const MAX_FINDINGS = 30;

const HIGH = ["password", "physical address", "date of birth", "dates of birth", "social security", "passport", "credit card", "bank", "government"];
const MEDIUM = ["phone", "name", "ip address", "geographic", "gender", "username", "employer"];

function severityOf(exposed: string[], passwordRisk?: string): Severity {
  const text = exposed.join(" ").toLowerCase();
  if (passwordRisk === "plaintext" || passwordRisk === "easytocrack") return "high";
  if (HIGH.some((w) => text.includes(w))) return "high";
  if (MEDIUM.some((w) => text.includes(w))) return "medium";
  return "low";
}

const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function finalize(findings: Finding[]): { findings: Finding[]; total: number; names: string[] } {
  const sorted = findings.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.date ?? "").localeCompare(a.date ?? ""));
  return { findings: sorted.slice(0, MAX_FINDINGS), total: findings.length, names: findings.map((f) => f.site) };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
}

type HibpBreach = {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  Description: string;
  DataClasses: string[];
};

async function fromHibp(identifier: Identifier) {
  const breaches =
    (await getJson<HibpBreach[]>("HIBP", `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(identifier.value)}?truncateResponse=false`, {
      headers: { "hibp-api-key": config.hibpKey!, "user-agent": USER_AGENT },
    })) ?? [];
  return finalize(
    breaches.map((b) => ({
      id: `breach:${breachKey(b.Name)}`,
      source: "breach" as const,
      identifier,
      site: b.Title,
      title: `Found in the ${b.Title} breach`,
      detail: stripHtml(b.Description),
      exposed: b.DataClasses,
      severity: severityOf(b.DataClasses),
      url: b.Domain ? `https://${b.Domain}` : undefined,
      date: b.BreachDate?.slice(0, 4),
    })),
  );
}

type XonBreach = {
  breach: string;
  details: string;
  domain: string;
  xposed_data: string;
  xposed_date: string;
  password_risk: string;
};

async function fromXposedOrNot(identifier: Identifier) {
  const data = await getJson<{ ExposedBreaches?: { breaches_details?: XonBreach[] } | null }>(
    "XposedOrNot",
    `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(identifier.value)}`,
    { headers: { "user-agent": USER_AGENT } },
  );
  const breaches = data?.ExposedBreaches?.breaches_details ?? [];
  return finalize(
    breaches.map((b) => {
      const exposed = b.xposed_data.split(";").map((s) => s.trim()).filter(Boolean);
      return {
        id: `breach:${breachKey(b.breach)}`,
        source: "breach" as const,
        identifier,
        site: b.breach,
        title: `Found in the ${b.breach} breach`,
        detail: b.details,
        exposed,
        severity: severityOf(exposed, b.password_risk),
        url: b.domain ? `https://${b.domain}` : undefined,
        date: b.xposed_date,
      };
    }),
  );
}

export async function checkBreaches(identifier: Identifier) {
  return config.hibpKey ? fromHibp(identifier) : fromXposedOrNot(identifier);
}
