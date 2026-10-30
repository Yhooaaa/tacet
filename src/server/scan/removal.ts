import "server-only";
import type { Finding, Removal, RemovalDifficulty } from "@/types/scan";
import jdm from "./data/jdm-data.json";

type JdmSite = { name: string; url: string; difficulty: RemovalDifficulty; domains: string[]; notes?: string; email?: string };

const BY_DOMAIN = new Map<string, JdmSite>();
for (const site of (jdm as { sites: JdmSite[] }).sites) {
  for (const domain of site.domains) if (!BY_DOMAIN.has(domain)) BY_DOMAIN.set(domain, site);
}

const ARCHIVE_HOSTS = /(^|\.)(archive\.org|archive\.(ph|today|is|li|vn|md|fo))$/;

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function deletionGuide(url: string | undefined): JdmSite | null {
  const host = hostOf(url);
  if (!host || ARCHIVE_HOSTS.test(host)) return null;
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const hit = BY_DOMAIN.get(parts.slice(i).join("."));
    if (hit) return hit;
  }
  return null;
}

export function fromGuide(guide: JdmSite | null): Pick<Removal, "difficulty" | "url" | "urlLabel" | "email"> {
  if (!guide) return {};
  const selfService = guide.difficulty === "easy" || guide.difficulty === "medium";
  return {
    difficulty: guide.difficulty,
    url: guide.url,
    urlLabel: selfService ? `Delete your ${guide.name} account` : `${guide.name} deletion guide`,
    email: guide.email,
  };
}

function guideSteps(guide: JdmSite | null, site: string): string[] {
  if (!guide) return [`Sign in to ${site} and look for Delete account, usually under Settings, Account or Privacy.`];
  const steps: string[] = [];
  if (guide.difficulty === "impossible") steps.push(`${guide.name} doesn't let you delete your account yourself. Send an erasure request instead.`);
  else if (guide.difficulty === "hard") steps.push(`${guide.name} only deletes accounts on request. Contact them, or send the erasure request below.`);
  else if (guide.difficulty === "limited") steps.push(`${guide.name} only deletes accounts in some cases.`);
  if (guide.notes) steps.push(guide.notes);
  else if (guide.difficulty === "easy" || guide.difficulty === "medium") steps.push("Open the deletion page, sign in, and confirm.");
  if (guide.email) steps.push(`Their contact for deletion requests is ${guide.email}.`);
  return steps;
}

function forProfile(f: Finding): Removal {
  const guide = deletionGuide(f.url);
  return {
    ...fromGuide(guide),
    steps: [
      ...guideSteps(guide, f.site),
      "Want to keep the account? Remove your real name, photo, location and links from the profile, or make it private.",
      "Can't sign in any more? Send an erasure request. The site has to delete your data within a month under GDPR, or 45 days under CCPA.",
    ],
    letter: true,
  };
}

function forBreach(f: Finding): Removal {
  const guide = deletionGuide(f.url);
  return {
    ...fromGuide(guide),
    steps: [
      "Leaked copies can't be recalled, so make what leaked useless: change the password on this site and anywhere you used the same one.",
      "Turn on two-factor authentication wherever it's offered.",
      `If you no longer use ${f.site}, delete the account so it can't leak again.${guide?.notes ? ` ${guide.notes}` : ""}`,
      "Expect phishing that mentions this breach. Don't click links in emails that reference it.",
    ],
    letter: true,
  };
}

function forArchive(f: Finding): Removal {
  if (f.site.includes("Wayback Machine")) {
    return {
      difficulty: "medium",
      email: "info@archive.org",
      steps: [
        "Delete or clean up the original profile first, so new snapshots stop showing it.",
        "Email the Internet Archive at info@archive.org with the archived address and ask for it to be excluded. Say it contains your personal data.",
        "Removals usually take a few weeks. The archive can ask you to prove the page is about you.",
      ],
      letter: true,
    };
  }
  return {
    difficulty: "hard",
    steps: [
      "Delete or clean up the original profile first.",
      "archive.today has no formal removal process. It occasionally removes pages reported through its contact page, but often doesn't respond.",
      "If the copy exposes sensitive data, a search engine removal request can at least stop it showing up in results.",
    ],
    letter: false,
  };
}

function forWebPage(f: Finding): Removal {
  const guide = deletionGuide(f.url);
  const contactDetails = f.identifier.kind !== "username";
  const contact = contactDetails ? " Google also removes results that show your phone number, email or home address through Results about you." : "";
  return {
    ...fromGuide(guide),
    ...(!guide && contactDetails ? { url: "https://myactivity.google.com/results-about-you", urlLabel: "Google Results about you" } : {}),
    steps: [
      `If it's your own post or profile on ${f.site}, edit or delete it yourself.`,
      `If someone else published it, ask ${f.site} to take it down. Send the erasure request below to their contact or privacy address.`,
      `Once the page is gone, ask search engines to drop their copy: Google's Remove outdated content tool and Bing's Content removal tool.${contact}`,
    ],
    letter: true,
  };
}

export function withRemoval(f: Finding): Finding {
  if (f.removal) return f;
  const removal =
    f.source === "breach" ? forBreach(f) : f.source === "profile" ? forProfile(f) : f.id.startsWith("archive:") ? forArchive(f) : forWebPage(f);
  return { ...f, removal };
}
