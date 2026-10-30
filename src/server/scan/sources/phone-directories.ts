import "server-only";
import type { Finding } from "@/types/scan";
import type { Identifier } from "@/lib/identifiers";
import { requestSignal } from "../context";
import { outbound, readBody, scanFetch } from "../net";

const TIMEOUT = 12_000;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function page(url: string): Promise<{ status: number; text: string }> {
  return outbound(url, async () => {
    const res = await scanFetch(url, { headers: { "user-agent": BROWSER_UA, "accept-language": "en" }, signal: requestSignal(TIMEOUT) });
    const text = res.status === 200 ? await readBody(res, 400_000) : "";
    if (res.status !== 200) await res.body?.cancel().catch(() => {});
    return { status: res.status, text };
  });
}

type Directory = {
  name: string;
  url: (n: { area: string; prefix: string; line: string }) => string;
  listed: (r: { status: number; text: string }) => boolean | null;
};

const DIRECTORIES: Directory[] = [
  {
    name: "800notes",
    url: (n) => `https://800notes.com/Phone.aspx/1-${n.area}-${n.prefix}-${n.line}`,
    listed: (r) => (r.status === 200 ? true : r.status === 404 ? false : null),
  },
  {
    name: "WhoCallsMe",
    url: (n) => `https://www.whocallsme.com/Phone-Number.aspx/${n.area}${n.prefix}${n.line}`,
    listed: (r) => (r.status === 200 ? true : r.status === 404 ? false : null),
  },
  {
    name: "Should I Answer",
    url: (n) => `https://www.shouldianswer.com/phone-number/${n.area}${n.prefix}${n.line}`,
    listed: (r) => {
      if (r.status !== 200) return null;
      if (/no rating because we have no users reviews/i.test(r.text)) return false;
      return /\b[1-9][\d,]*\s+reviews?\b/i.test(r.text) ? true : null;
    },
  },
];


export async function checkPhoneDirectories(identifier: Identifier): Promise<Finding[]> {
  const m = identifier.value.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return [];
  const parts = { area: m[1], prefix: m[2], line: m[3] };
  const results = await Promise.allSettled(DIRECTORIES.map(async (d) => ({ d, url: d.url(parts), listed: d.listed(await page(d.url(parts))) })));
  const findings: Finding[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[noise] caller-ID directory failed", r.reason);
      continue;
    }
    const { d, url, listed } = r.value;
    if (!listed) continue;
    findings.push({
      id: `callerid:${d.name}`,
      source: "web",
      identifier,
      site: d.name,
      title: `Number listed on ${d.name}`,
      detail: `${d.name} has a page for this number with reports from people it called. Anyone who looks the number up sees those comments and ratings, and some list a name with it.`,
      exposed: ["Phone number"],
      severity: "low",
      url,
      removal: {
        difficulty: "medium",
        url,
        urlLabel: `Open the ${d.name} page`,
        steps: [
          "Open the page and check what it says about the number and whether it names you.",
          `Ask ${d.name} to remove the page through its contact or removal form, explaining that it's your personal number.`,
          "If they don't respond, send an erasure request. Under GDPR or CCPA they have to remove your personal data.",
        ],
        letter: true,
      },
    });
  }
  return findings;
}
