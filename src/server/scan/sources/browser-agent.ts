import "server-only";
import type { Browser, BrowserContext, Page, PuppeteerNode } from "puppeteer";
import type { Identifier } from "@/lib/identifiers";
import { phoneQuery } from "@/lib/phone";
import { mentionsIdentifier } from "./mentions";
import type { Finding } from "@/types/scan";
import { envInt, FairSemaphore } from "@/server/utils/limiter";
import { currentScan } from "../context";
import { mapLimit } from "./site-check";
import { unwrapUrl } from "./web-extended";

let puppeteerModule: PuppeteerNode | null = null;

async function getPuppeteer() {
  if (puppeteerModule) return puppeteerModule;
  try {
    puppeteerModule = (await import("puppeteer")).default;
    return puppeteerModule;
  } catch {
    return null;
  }
}

const TAB_LIMIT = new FairSemaphore(envInt("NOISE_BROWSER_TABS", 6));
const IDLE_CLOSE_MS = 2 * 60 * 1000;

let browser: Promise<Browser> | null = null;
let current: Browser | null = null;
let leases = 0;
let idleTimer: NodeJS.Timeout | null = null;

async function serverlessChrome(): Promise<{ executablePath: string; args: string[] } | null> {
  if (!process.env.VERCEL) return null;
  const chromium = (await import("@sparticuz/chromium")).default;
  return { executablePath: await chromium.executablePath(), args: chromium.args };
}

async function launch(puppeteer: PuppeteerNode): Promise<Browser> {
  const root = process.getuid?.() === 0;
  const serverless = await serverlessChrome();
  const instance = await puppeteer.launch({
    headless: true,
    executablePath: serverless?.executablePath,
    args: serverless?.args ?? [...(root ? ["--no-sandbox", "--disable-setuid-sandbox"] : []), "--disable-dev-shm-usage"],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });
  instance.on("disconnected", () => {
    if (current === instance) browser = null;
  });
  current = instance;
  return instance;
}

async function leaseBrowser(): Promise<{ browser: Browser; done: () => void } | null> {
  const puppeteer = await getPuppeteer();
  if (!puppeteer) return null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  leases += 1;
  try {
    const seen = browser;
    let instance = seen ? await seen.catch(() => null) : null;
    if (!instance?.connected) {
      if (browser === seen) {
        const launching = launch(puppeteer);
        browser = launching;
        launching.catch(() => {
          if (browser === launching) browser = null;
        });
      }
      instance = await browser!;
    }
    let returned = false;
    return {
      browser: instance,
      done: () => {
        if (returned) return;
        returned = true;
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}

function release() {
  leases -= 1;
  if (leases > 0) return;
  idleTimer = setTimeout(() => {
    const closing = browser;
    browser = null;
    current = null;
    closing?.then((b) => b.close()).catch(() => {});
  }, IDLE_CLOSE_MS);
  idleTimer.unref();
}

export const browserStats = () => ({ running: Boolean(browser), leases, tabs: TAB_LIMIT.active, waitingTabs: TAB_LIMIT.queued, tabLimit: TAB_LIMIT.capacity });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const NAV_TIMEOUT = 20000;
const TABS = 4;

function queryFor({ kind, value }: Identifier): string {
  if (kind === "phone") {
    return phoneQuery(value);
  }
  return `"${value}"`;
}

type Engine = { name: string; url: (q: string) => string; own: RegExp };

const SEARCH_ENGINES: Engine[] = [
  { name: "Google", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en`, own: /(^|\.)(google\.[a-z.]+|gstatic\.com|googleusercontent\.com|blogger\.com)$/ },
  { name: "Bing", url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en&cc=US`, own: /(^|\.)(bing\.com|microsoft\.com|msn\.com|live\.com)$/ },
  { name: "DuckDuckGo", url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, own: /(^|\.)duckduckgo\.com$/ },
  { name: "Brave Search", url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`, own: /(^|\.)(brave\.com)$/ },
  { name: "Startpage", url: (q) => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`, own: /(^|\.)(startpage\.com)$/ },
  { name: "Yandex", url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`, own: /(^|\.)(yandex\.[a-z.]+|ya\.ru|yastatic\.net)$/ },
  { name: "Ecosia", url: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`, own: /(^|\.)(ecosia\.org)$/ },
  { name: "Qwant", url: (q) => `https://www.qwant.com/?q=${encodeURIComponent(q)}&t=web`, own: /(^|\.)(qwant\.com)$/ },
];

const BLOCKED = /unusual traffic|captcha|are you a robot|verify you are human|not a robot|just a moment|access denied|before you continue|подтвердите, что запросы|sorry\/index|showcaptcha/i;

type Link = { href: string; text: string; block: string };

async function collectLinks(page: Page): Promise<Link[]> {
  return page.evaluate(() => {
    const out: { href: string; text: string; block: string }[] = [];
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const href = (a as HTMLAnchorElement).href;
      if (!/^https?:/.test(href)) continue;
      const text = (a.textContent ?? "").trim();
      if (text.length < 4) continue;
      let block: Element = a;
      for (let i = 0; i < 5 && block.parentElement; i++) {
        const parent = block.parentElement;
        if (parent.querySelectorAll("a[href]").length > 6) break;
        block = parent;
        if ((block.textContent ?? "").length > 160) break;
      }
      out.push({ href, text, block: (block.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500) });
    }
    return out;
  });
}

async function openPage(context: BrowserContext, url: string) {
  const page = await context.newPage();
  await page.setUserAgent(UA);
  await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 5000 }).catch(() => {});
  return { page, status: res?.status() ?? 0 };
}

async function withTab<T>(fn: () => Promise<T>): Promise<T> {
  const scan = currentScan();
  const release = await TAB_LIMIT.acquire(scan?.id, scan?.signal);
  try {
    return await fn();
  } finally {
    release();
  }
}

type EngineOutcome = { engine: string; findings: Finding[]; blocked: boolean };

async function searchEngine(browser: BrowserContext, engine: Engine, id: Identifier): Promise<EngineOutcome> {
  let page: Page | undefined;
  try {
    const opened = await openPage(browser, engine.url(queryFor(id)));
    page = opened.page;
    const title = await page.title();
    const head = (await page.evaluate(() => document.body?.innerText.slice(0, 2000) ?? "")) + " " + page.url();
    if (opened.status >= 400 || BLOCKED.test(title) || BLOCKED.test(head)) {
      return { engine: engine.name, findings: [], blocked: true };
    }
    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const link of await collectLinks(page)) {
      const url = unwrapUrl(link.href);
      if (!url || seen.has(url)) continue;
      let host: string;
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      if (engine.own.test(host)) continue;
      if (!mentionsIdentifier(id, link.text, link.block, decodeURIComponent(url))) continue;
      seen.add(url);
      findings.push({
        id: `web:${url}`,
        source: "web",
        identifier: id,
        site: host,
        title: link.text.slice(0, 140),
        detail: `${link.block.slice(0, 280)}${link.block.length > 280 ? "..." : ""}\n(found via ${engine.name})`,
        exposed: id.kind === "phone" ? ["Phone number"] : id.kind === "email" ? ["Email"] : ["Username"],
        severity: id.kind === "username" ? "low" : "medium",
        url,
      });
    }
    return { engine: engine.name, findings: findings.slice(0, 10), blocked: false };
  } catch {
    return { engine: engine.name, findings: [], blocked: true };
  } finally {
    await page?.close().catch(() => {});
  }
}

type BrowserProfile = { name: string; url: string; found: (title: string, u: string) => boolean; missing: (title: string, text: string) => boolean };

const BROWSER_PROFILES: BrowserProfile[] = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/{u}/",
    found: (t, u) => t.toLowerCase().includes(`(@${u.toLowerCase()})`),
    missing: (t, x) => /isn't available|not available|недоступ/i.test(t + x),
  },
  {
    name: "Threads",
    url: "https://www.threads.net/@{u}",
    found: (t, u) => t.toLowerCase().includes(`(@${u.toLowerCase()})`),
    missing: (t, x) => /not available|isn't available|недоступ/i.test(t + x),
  },
  {
    name: "Reddit",
    url: "https://www.reddit.com/user/{u}/",
    found: (t, u) => t.toLowerCase().includes(`u/${u.toLowerCase()}`) && !/nobody on reddit/i.test(t),
    missing: (_t, x) => /nobody on reddit goes by that name|page not found/i.test(x),
  },
];

async function checkProfile(browser: BrowserContext, site: BrowserProfile, id: Identifier): Promise<Finding | null> {
  const url = site.url.replace("{u}", id.value);
  let page: Page | undefined;
  try {
    const opened = await openPage(browser, url);
    page = opened.page;
    const title = await page.title();
    const text = await page.evaluate(() => document.body?.innerText.slice(0, 3000) ?? "");
    if (site.missing(title, text) || !site.found(title, id.value)) return null;
    return {
      id: `profile:${id.value}:${site.name}`,
      source: "profile",
      identifier: id,
      site: site.name,
      title: `Public ${site.name} profile`,
      detail: `Public profile with the same username.\nPage title: ${title.slice(0, 140)}`,
      exposed: ["Username"],
      severity: "low",
      url,
    };
  } catch {
    return null;
  } finally {
    await page?.close().catch(() => {});
  }
}

export type BrowserScan = { findings: Finding[]; engines: number; blocked: string[] };

export async function searchWebBrowser(identifier: Identifier): Promise<BrowserScan> {
  const lease = await leaseBrowser();
  if (!lease) return { findings: [], engines: 0, blocked: [] };
  const blocked: string[] = [];
  let context: BrowserContext | undefined;
  try {
    context = await lease.browser.createBrowserContext();
    const ctx = context;
    const tasks: (() => Promise<Finding[]>)[] = [
      ...SEARCH_ENGINES.map((engine) => async () => {
        const r = await searchEngine(ctx, engine, identifier);
        if (r.blocked) blocked.push(r.engine);
        return r.findings;
      }),
      ...(identifier.kind === "username"
        ? BROWSER_PROFILES.map((site) => async () => {
            const f = await checkProfile(ctx, site, identifier);
            return f ? [f] : [];
          })
        : []),
    ];
    const results = await mapLimit(tasks, TABS, (task) => withTab(task).catch(() => [] as Finding[]));

    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const f of results.flat()) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      findings.push(f);
    }
    return { findings: findings.slice(0, 60), engines: SEARCH_ENGINES.length, blocked };
  } finally {
    await context?.close().catch(() => {});
    lease.done();
  }
}
