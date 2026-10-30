import { KIND_LABEL } from "./identifiers";
import type { Finding, RemovalDifficulty } from "@/types/scan";

export type Law = "gdpr" | "ccpa";

export const LAW_LABEL: Record<Law, string> = { gdpr: "GDPR (EU and UK)", ccpa: "CCPA (California)" };

export const DIFFICULTY_LABEL: Record<RemovalDifficulty, string> = {
  easy: "Easy",
  medium: "Some effort",
  hard: "On request only",
  limited: "Limited",
  impossible: "No self-service",
};

function subjectOf(f: Finding): string {
  if (f.source === "breach") return `my account and the data exposed in the ${f.site} breach`;
  if (f.source === "profile") return `my ${f.site} account`;
  return `the page about me on ${f.site}`;
}

export function removalLetter(f: Finding, law: Law): { subject: string; body: string } {
  const details = [`${KIND_LABEL[f.identifier.kind]}: ${f.identifier.value}`, ...(f.url ? [`Address: ${f.url}`] : [])];

  if (law === "gdpr") {
    return {
      subject: "Erasure request under Article 17 GDPR",
      body: [
        "Hello,",
        "",
        `I'm asking you to erase all personal data you hold about me, under Article 17 of the General Data Protection Regulation (GDPR and UK GDPR). This request covers ${subjectOf(f)}.`,
        "",
        "To find my data:",
        ...details.map((d) => `- ${d}`),
        "",
        "Please:",
        "1. Delete my personal data, including the account or page above.",
        "2. Tell anyone you've shared it with about this request, as Article 19 requires.",
        "3. Confirm in writing once it's done.",
        "",
        "You have one month from receiving this request to respond (Article 12(3)). If you need to confirm my identity, tell me exactly what you need and I'll provide only that.",
        "",
        "Thank you,",
        "[Your name]",
      ].join("\n"),
    };
  }

  return {
    subject: "Request to delete personal information (CCPA)",
    body: [
      "Hello,",
      "",
      `I'm asking you to delete all personal information you've collected about me, under the California Consumer Privacy Act (Cal. Civ. Code § 1798.105). This request covers ${subjectOf(f)}.`,
      "",
      "To find my information:",
      ...details.map((d) => `- ${d}`),
      "",
      "Please:",
      "1. Delete my personal information, and direct your service providers and contractors to do the same.",
      "2. Stop selling or sharing my personal information (§ 1798.120).",
      "3. Confirm in writing once it's done.",
      "",
      "You have 45 days to respond (§ 1798.130). If you need to verify my identity, tell me exactly what you need.",
      "",
      "Thank you,",
      "[Your name]",
    ].join("\n"),
  };
}

export function mailtoLink(to: string | undefined, letter: { subject: string; body: string }): string {
  return `mailto:${to ? encodeURIComponent(to) : ""}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`;
}

export function removalPlan(findings: Finding[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`Tacet removal plan, ${date}`, "", "Work from the top: the list is ordered by risk. Tick each item off as you go.", ""];
  findings.forEach((f, i) => {
    const r = f.removal;
    lines.push(`${i + 1}. [ ] ${f.title} (${f.severity} risk)`);
    if (f.url) lines.push(`   Found at: ${f.url}`);
    if (r?.difficulty) lines.push(`   Difficulty: ${DIFFICULTY_LABEL[r.difficulty]}`);
    if (r?.url) lines.push(`   ${r.urlLabel ?? "Removal page"}: ${r.url}`);
    if (r?.email) lines.push(`   Contact: ${r.email}`);
    for (const step of r?.steps ?? []) lines.push(`   - ${step}`);
    lines.push("");
  });
  lines.push(
    "Erasure request template",
    "Where a step says to send an erasure request, email the site's privacy or support address with this, filling in the brackets.",
    "Under GDPR the site has one month to respond; under CCPA, 45 days.",
    "",
    "Subject: Erasure request under Article 17 GDPR (or: Request to delete personal information under CCPA § 1798.105)",
    "",
    "Hello,",
    "",
    "I'm asking you to erase all personal data you hold about me, including my account or the page at [address]. You can find it by [email, phone number or username].",
    "Please delete it, tell anyone you've shared it with, and confirm in writing once it's done.",
    "",
    "Thank you,",
    "[Your name]",
  );
  return lines.join("\n");
}
