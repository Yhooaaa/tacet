import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, GoogleGenAI } from "@google/genai";
import { maskIdentifier, type Identifier } from "@/lib/identifiers";
import type { Finding, Report, Severity } from "@/types/scan";
import { config } from "../config";
import { envInt, FairSemaphore } from "@/server/utils/limiter";
import { currentScan, requestSignal, scanCancelled } from "./context";

const CLAUDE_MODEL = "claude-opus-5-5";

const AI_LIMIT = new FairSemaphore(envInt("NOISE_AI_CONCURRENCY", 4));
const QUEUE_WAIT_MS = 20_000;
const MODEL_TIMEOUT_MS = 60_000;

export const aiStats = () => ({ active: AI_LIMIT.active, waiting: AI_LIMIT.queued, limit: AI_LIMIT.capacity });

const WEIGHT: Record<Severity, number> = { high: 16, medium: 7, low: 2 };

function levelOf(score: number): Report["level"] {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 20) return "Moderate";
  return "Low";
}

function field(finding: Finding, name: string): string | undefined {
  return finding.detail.split("\n").find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2);
}

function scoreOf(findings: Finding[]): number {
  const accounts = findings.filter((f) => f.id.startsWith("account:")).length;
  const raw = findings.filter((f) => !f.id.startsWith("account:")).reduce((sum, f) => sum + WEIGHT[f.severity], 0) + Math.min(accounts, 5);
  return Math.round(100 * (1 - Math.exp(-raw / 50)));
}

function ruleReport(identifiers: Identifier[], findings: Finding[]): Report {
  const score = scoreOf(findings);
  const breaches = findings.filter((f) => f.source === "breach");
  const profiles = findings.filter((f) => f.source === "profile");
  const mentions = findings.filter((f) => f.source === "web");
  const passwordBreaches = breaches.filter((f) => f.exposed.some((e) => /password/i.test(e)));
  const revealing = profiles.filter((f) => f.exposed.includes("Name") || f.exposed.includes("Location"));

  let chain: Report["chain"] = null;
  const anchor = revealing[0];
  if (anchor) {
    const links = [
      { label: "Username", value: anchor.identifier.value },
      { label: `${anchor.site} profile`, value: anchor.url ?? anchor.site },
    ];
    const name = field(anchor, "Name");
    const location = field(anchor, "Location");
    if (name) links.push({ label: "Real name", value: name });
    if (location) links.push({ label: "Location", value: location });
    chain = { links, breakAt: `Remove your ${name ? "name" : "location"} from your ${anchor.site} profile.` };
  } else if (breaches.some((f) => f.exposed.includes("Names"))) {
    const breach = breaches.find((f) => f.exposed.includes("Names"))!;
    chain = {
      links: [
        { label: "Email", value: maskIdentifier(breach.identifier) },
        { label: "Breach", value: `${breach.site}${breach.date ? `, ${breach.date}` : ""}` },
        { label: "Exposed with it", value: breach.exposed.slice(0, 4).join(", ") },
      ],
      breakAt: "Leaked records can't be deleted, so cut what they unlock: change those passwords and turn on two-factor sign-in.",
    };
  }

  const actions: Report["actions"] = [];
  if (passwordBreaches.length) {
    actions.push({
      title: "Change the passwords that leaked",
      detail: `Your password was exposed in ${passwordBreaches.length} breach${passwordBreaches.length > 1 ? "es" : ""}, including ${passwordBreaches
        .slice(0, 3)
        .map((f) => f.site)
        .join(", ")}. Change it there and anywhere you reused it, and use a password manager so each site gets its own.`,
      priority: "now",
      findingIds: passwordBreaches.map((f) => f.id),
    });
  }
  if (breaches.length) {
    actions.push({
      title: "Turn on two-factor sign-in",
      detail: "Breached emails get targeted by credential stuffing and phishing. Two-factor sign-in on your email and main accounts stops most of it.",
      priority: passwordBreaches.length ? "now" : "soon",
      findingIds: breaches.map((f) => f.id),
    });
  }
  for (const f of revealing.slice(0, 3)) {
    actions.push({
      title: `Edit your ${f.site} profile`,
      detail: `It shows your ${f.exposed.filter((e) => e !== "Bio").join(", ").toLowerCase()} next to this username. Remove what you don't need to be public.`,
      priority: "soon",
      findingIds: [f.id],
    });
  }
  if (mentions.length) {
    actions.push({
      title: "Ask sites to remove your details",
      detail: `Your details appear on ${mentions.length} public page${mentions.length > 1 ? "s" : ""}. Under GDPR and CCPA you can ask the site owner to delete them.`,
      priority: "soon",
      findingIds: mentions.map((f) => f.id),
    });
  }
  const quiet = profiles.filter((f) => !revealing.includes(f));
  if (quiet.length) {
    const accounts = quiet.filter((f) => f.id.startsWith("account:"));
    const named = quiet.length - accounts.length;
    const parts = [
      named && `this username is registered on ${named} more site${named > 1 ? "s" : ""}`,
      accounts.length &&
        `your email has accounts on ${accounts.length} service${accounts.length > 1 ? "s" : ""}${accounts.length <= 3 ? ` (${accounts.map((f) => f.site).join(", ")})` : ""}`,
    ].filter(Boolean) as string[];
    const sentence = parts.join(", and ");
    actions.push({
      title: "Close accounts you no longer use",
      detail: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. Each one is another place your data can leak from, and makes it easier to link your accounts together.`,
      priority: "later",
      findingIds: quiet.map((f) => f.id),
    });
  }

  const names = [...new Set(identifiers.map((i) => (i.kind === "phone" ? "phone number" : i.kind)))];
  const kinds = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  const summary = findings.length
    ? `We found ${findings.length} exposure${findings.length > 1 ? "s" : ""} across ${new Set(findings.map((f) => f.site)).size} sources for the ${kinds} you scanned.${
        passwordBreaches.length ? " Leaked passwords are the most urgent." : revealing.length ? " Public profiles that show your real name are the easiest to fix." : ""
      }`
    : `Nothing turned up for the ${kinds} you scanned. Run a scan again later, or add another detail to check.`;

  return { score, level: levelOf(score), summary, chain, actions, analyzedBy: "rules" };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "chain_links", "chain_break", "actions"],
  properties: {
    score: { type: "integer", description: "Overall exposure from 0 (nothing found) to 100 (identity fully reconstructable)." },
    summary: { type: "string", description: "Two or three plain sentences for the person: what is exposed and what matters most." },
    chain_links: {
      type: "array",
      description: "The most dangerous chain from a scanned detail to the person's real identity, in order. Empty if no chain exists.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: { label: { type: "string" }, value: { type: "string" } },
      },
    },
    chain_break: { type: "string", description: "The single change that breaks the chain earliest. Empty if there is no chain." },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "priority", "finding_ids"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["now", "soon", "later"] },
          finding_ids: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the analysis step of Tacet, a privacy service that helps people find and reduce their own online exposure. The person has proven they own the emails and phone numbers listed. Usernames are entered as their own but can't be proven, and the same username on another site may belong to someone else, so treat profile findings as likely theirs, not certain.

Your job:
- Score overall exposure 0-100. Leaked passwords, home addresses, dates of birth and anything that links a pseudonym to a real name weigh most.
- Find the most dangerous chain: how someone starting from one of these details could reach the person's real name, location or other accounts, using only the findings. Use only links the findings support; never invent data.
- Write up to 6 concrete actions, most urgent first, each tied to finding ids. Prefer specific steps ("Remove your city from your GitHub profile") over general advice.

Write for a non-technical reader: plain, calm, specific. No alarmism, no marketing. Use the person's data as given; don't repeat full email addresses or phone numbers.`;

type ModelOutput = {
  score: number;
  summary: string;
  chain_links: { label: string; value: string }[];
  chain_break: string;
  actions: { title: string; detail: string; priority: "now" | "soon" | "later"; finding_ids: string[] }[];
};

function buildPrompt(identifiers: Identifier[], findings: Finding[]): string {
  const payload = {
    details: identifiers.map((i) => ({ kind: i.kind, value: i.kind === "username" ? i.value : maskIdentifier(i) })),
    findings: findings.map((f) => ({
      id: f.id,
      source: f.source,
      for: f.identifier.kind === "username" ? f.identifier.value : maskIdentifier(f.identifier),
      site: f.site,
      title: f.title,
      detail: f.detail.slice(0, 400),
      exposed: f.exposed,
      severity: f.severity,
      date: f.date,
      links: f.links,
    })),
  };
  return `Scan results:\n${JSON.stringify(payload)}`;
}

async function claudeOutput(prompt: string): Promise<ModelOutput> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  }, { signal: requestSignal(MODEL_TIMEOUT_MS), maxRetries: 1 });
  if (response.stop_reason !== "end_turn") throw new Error(`Analysis stopped: ${response.stop_reason}`);
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Analysis returned no text");
  return JSON.parse(text.text) as ModelOutput;
}

function forGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(forGemini);
  if (schema && typeof schema === "object") {
    return Object.fromEntries(
      Object.entries(schema)
        .filter(([k]) => k !== "additionalProperties")
        .map(([k, v]) => [k, forGemini(v)]),
    );
  }
  return schema;
}

const GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest";
const PRIMARY_TIMEOUT_MS = 25_000;

async function geminiOutput(prompt: string): Promise<ModelOutput> {
  const primary = config.gemini!.model;
  try {
    return await geminiCall(prompt, primary, PRIMARY_TIMEOUT_MS);
  } catch (error) {
    const busy = error instanceof ApiError && (error.status === 503 || error.status === 429);
    const stalled = error instanceof Error && error.name === "AbortError" && !scanCancelled();
    if (primary === GEMINI_FALLBACK_MODEL || !(busy || stalled)) throw error;
    console.warn(`[noise] Gemini ${primary} ${busy ? `busy (${(error as ApiError).status})` : "too slow"}; using ${GEMINI_FALLBACK_MODEL}`);
    return geminiCall(prompt, GEMINI_FALLBACK_MODEL, MODEL_TIMEOUT_MS);
  }
}

async function geminiCall(prompt: string, model: string, timeoutMs: number): Promise<ModelOutput> {
  const ai = new GoogleGenAI({ apiKey: config.gemini!.apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      responseJsonSchema: forGemini(SCHEMA),
      abortSignal: requestSignal(timeoutMs),
    },
  });
  if (!response.text) throw new Error(`Analysis returned no text (${response.candidates?.[0]?.finishReason ?? "unknown"})`);
  return JSON.parse(response.text) as ModelOutput;
}

function toReport(out: ModelOutput, findings: Finding[], analyzedBy: Report["analyzedBy"]): Report {
  const ids = new Set(findings.map((f) => f.id));
  const score = Math.max(0, Math.min(100, Math.round(out.score)));
  return {
    score,
    level: levelOf(score),
    summary: out.summary,
    chain: out.chain_links.length >= 2 ? { links: out.chain_links, breakAt: out.chain_break } : null,
    actions: out.actions.slice(0, 6).map((a) => ({
      title: a.title,
      detail: a.detail,
      priority: a.priority,
      findingIds: a.finding_ids.filter((id) => ids.has(id)),
    })),
    analyzedBy,
  };
}

export async function analyze(identifiers: Identifier[], findings: Finding[], { ai = true }: { ai?: boolean } = {}): Promise<Report> {
  const provider = !ai ? null : config.gemini ? "gemini" : config.anthropic ? "claude" : null;
  if (!provider || findings.length === 0) return ruleReport(identifiers, findings);
  const prompt = buildPrompt(identifiers, findings);
  const scan = currentScan();
  let release: (() => void) | undefined;
  try {
    const wait = AbortSignal.timeout(QUEUE_WAIT_MS);
    release = await AI_LIMIT.acquire(scan?.id, scan ? AbortSignal.any([wait, scan.signal]) : wait);
    const out = provider === "gemini" ? await geminiOutput(prompt) : await claudeOutput(prompt);
    return toReport(out, findings, provider);
  } catch (error) {
    if (!release) {
      console.warn("[noise] analysis queue full; using rules");
      return ruleReport(identifiers, findings);
    }
    if (error instanceof ApiError) console.error(`[noise] Gemini API error ${error.status}`, error.message);
    else if (error instanceof Anthropic.RateLimitError) console.warn("[noise] Claude rate limited; using rules");
    else if (error instanceof Anthropic.APIError) console.error(`[noise] Claude API error ${error.status}`, error.message);
    else console.error("[noise] analysis failed", error);
    return ruleReport(identifiers, findings);
  } finally {
    release?.();
  }
}
