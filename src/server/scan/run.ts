import "server-only";
import type { Identifier } from "@/lib/identifiers";
import type { Finding, ScanEvent } from "@/types/scan";
import { config } from "../config";
import { analyze } from "./analyze";
import { checkBreaches } from "./sources/breaches";
import { checkOpenLeaks } from "./sources/leaks";
import { checkEmailAccounts, checkEmailPublished, EMAIL_SERVICE_COUNT } from "./sources/email-accounts";
import { checkPhoneDirectories } from "./sources/phone-directories";
import { checkGravatar, checkUsername, USERNAME_SITE_COUNT } from "./sources/profiles";
import { checkUsernameExtended, USERNAME_SITE_COUNT as EXTENDED_SITE_COUNT } from "./sources/profiles-extended";
import { searchWeb } from "./sources/web";
import { searchWebExtended } from "./sources/web-extended";
import { searchWebBrowser } from "./sources/browser-agent";
import { withRemoval } from "./removal";

const webUrl = (url: string | undefined) => (url && /^https?:\/\//i.test(url) ? url : undefined);

function siteOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function clean(f: Finding): Finding {
  const done = withRemoval({ ...f, url: webUrl(f.url), links: f.links?.filter((l) => webUrl(l)) });
  return done.removal ? { ...done, removal: { ...done.removal, url: webUrl(done.removal.url) } } : done;
}

type Emit = (event: ScanEvent) => void;

export async function runScan(identifiers: Identifier[], emit: Emit, { deep }: { deep: boolean }) {
  const findings: Finding[] = [];
  const breachSites = new Set<string>();
  const add = (list: Finding[]) => {
    let added = 0;
    for (const raw of list) {
      if (findings.some((x) => x.id === raw.id)) continue;
      const site = raw.source === "breach" ? siteOf(raw.url) : null;
      if (site) {
        if (breachSites.has(site)) continue;
        breachSites.add(site);
      }
      const f = clean(raw);
      findings.push(f);
      emit({ type: "finding", finding: f });
      added += 1;
    }
    return added;
  };

  const emails = identifiers.filter((i) => i.kind === "email");
  const usernames = identifiers.filter((i) => i.kind === "username");
  const phones = identifiers.filter((i) => i.kind === "phone");

  const breaches = async () => {
    emit({
      type: "step",
      id: "breaches",
      label: "Data breaches",
      status: "running",
      note: emails.length ? "Searching known breaches, open leak indexes and infostealer logs" : "Searching open leak indexes and infostealer logs",
    });
    let total = 0;
    let failed = 0;
    let attempted = 0;
    await Promise.all(
      identifiers.map(async (id) => {
        if (id.kind === "email") {
          attempted += 1;
          try {
            total += add((await checkBreaches(id)).findings);
          } catch (error) {
            failed += 1;
            console.error("[noise] breach check failed", error);
          }
        }
        const leaks = await checkOpenLeaks(id);
        attempted += leaks.sources;
        failed += leaks.failed;
        total += add(leaks.findings);
      }),
    );
    if (failed === attempted) {
      emit({ type: "step", id: "breaches", label: "Data breaches", status: "error", note: "The breach indexes didn't respond. Try again in a minute." });
    } else {
      emit({ type: "step", id: "breaches", label: "Data breaches", status: "done", count: total, note: total ? `Found in ${total} breach${total > 1 ? "es" : ""} and leak${total > 1 ? "s" : ""}` : "Not found in any known breach or open leak" });
    }
  };

  const profiles = async () => {
    emit({
      type: "step",
      id: "profiles",
      label: "Public profiles",
      status: "running",
      note: [
        usernames.length && `Checking ${USERNAME_SITE_COUNT + EXTENDED_SITE_COUNT} sites for your usernames`,
        emails.length && `Checking which of ${EMAIL_SERVICE_COUNT} services your email is registered on`,
      ]
        .filter(Boolean)
        .join(" · ") || "Checking public profiles",
    });
    let count = 0;
    let checked = 0;
    let unknown = 0;
    let skipped = 0;
    const jobs = [
      ...usernames.flatMap((u) => [
        checkUsername(u).then((r) => {
          count += add(r.findings);
          checked += r.checked;
          unknown += r.unknown;
        }),
        checkUsernameExtended(u).then((r) => {
          count += add(r.findings);
          checked += r.checked;
          unknown += r.unknown;
          skipped += r.skipped;
        }),
      ]),
      ...emails.map(async (e) => {
        const g = await checkGravatar(e).catch(() => null);
        if (g) count += add([g]);
      }),
      ...emails.map((e) =>
        checkEmailAccounts(e).then((r) => {
          count += add(r.findings);
          checked += r.checked;
          unknown += r.unknown;
        }),
      ),
    ];
    const settled = await Promise.allSettled(jobs);
    for (const r of settled) if (r.status === "rejected") console.error("[noise] profile check failed", r.reason);
    const noun = usernames.length && emails.length ? "accounts and profiles" : usernames.length ? `public profile${count === 1 ? "" : "s"}` : `account${count === 1 ? "" : "s"}`;
    const found = count ? `${count} ${noun} found` : `No ${usernames.length && emails.length ? "accounts or profiles" : usernames.length ? "public profiles" : "accounts"} found`;
    const coverage = !checked
      ? ""
      : skipped
        ? ` · ${(checked - unknown).toLocaleString("en-US")} of the ${(checked - skipped).toLocaleString("en-US")} most-visited sites answered; the ${skipped.toLocaleString("en-US")} least-visited were skipped to keep the scan quick`
        : ` · ${(checked - unknown).toLocaleString("en-US")} of ${checked.toLocaleString("en-US")} sites answered`;
    emit({ type: "step", id: "profiles", label: "Public profiles", status: "done", count, note: found + coverage });
  };

  const web = async () => {
    emit({
      type: "step",
      id: "web",
      label: "Open web",
      status: "running",
      note: [
        usernames.length ? "Searching the open web, Wayback Machine and archive.today" : "Searching the open web",
        emails.length && "GitHub commits and PGP key servers",
        phones.some((p) => p.value.startsWith("+1")) && "caller-ID directories",
      ]
        .filter(Boolean)
        .join(", "),
    });
    let count = 0;
    await Promise.all(
      identifiers.flatMap((id) => [
        searchWebExtended(id).then(
          (found) => (count += add(found ?? [])),
          (error) => console.error("[noise] extended web search failed", error),
        ),
        ...(config.braveKey
          ? [
              searchWeb(id).then(
                (found) => (count += add(found ?? [])),
                (error) => console.error("[noise] brave web search failed", error),
              ),
            ]
          : []),
        ...(id.kind === "email"
          ? [checkEmailPublished(id).then((found) => (count += add(found)), (error) => console.error("[noise] email publication check failed", error))]
          : []),
        ...(id.kind === "phone"
          ? [checkPhoneDirectories(id).then((found) => (count += add(found)), (error) => console.error("[noise] caller-ID check failed", error))]
          : []),
      ]),
    );
    emit({ type: "step", id: "web", label: "Open web", status: "done", count, note: count ? `${count} public mention${count > 1 ? "s" : ""}` : "No public mentions found" });
  };

  const browser = async () => {
    if (!deep) {
      emit({ type: "step", id: "browser", label: "Browser agent", status: "skipped", note: "Part of the deep scan: AI agents search 8 search engines in a real browser" });
      return;
    }
    emit({ type: "step", id: "browser", label: "Browser agent", status: "running", note: "Searching 8 engines and browser-only profiles in a real browser" });
    let count = 0;
    const blocked = new Set<string>();
    let engines = 0;
    for (const id of identifiers) {
      try {
        const r = await searchWebBrowser(id);
        count += add(r.findings);
        engines = r.engines;
        for (const name of r.blocked) blocked.add(name);
      } catch (error) {
        console.error("[noise] browser agent failed", error instanceof Error ? error.stack : error);
      }
    }
    if (blocked.size) console.info(`[noise] browser agent blocked by: ${[...blocked].join(", ")}`);
    const found = count ? `${count} browser result${count > 1 ? "s" : ""}` : "No browser results";
    const answered = engines ? ` · ${engines - blocked.size} of ${engines} search engines answered` : "";
    emit({ type: "step", id: "browser", label: "Browser agent", status: "done", count, note: found + answered });
  };

  await Promise.all([breaches(), profiles(), web(), browser()]);

  const ai = deep && Boolean(config.gemini || config.anthropic);
  emit({ type: "step", id: "analysis", label: "Analysis", status: "running", note: ai ? "Connecting what we found" : "Ranking what we found" });
  const report = await analyze(identifiers, findings, { ai });
  emit({ type: "step", id: "analysis", label: "Analysis", status: "done" });
  emit({ type: "report", report: { ...report, deep } });
  emit({ type: "done" });
}
