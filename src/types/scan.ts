import type { Identifier } from "@/lib/identifiers";

export type Severity = "high" | "medium" | "low";

export type FindingSource = "breach" | "profile" | "web";

export type RemovalDifficulty = "easy" | "medium" | "hard" | "impossible" | "limited";

export type Removal = {
  difficulty?: RemovalDifficulty;
  url?: string;
  urlLabel?: string;
  email?: string;
  steps: string[];
  letter: boolean;
};

export type Finding = {
  id: string;
  source: FindingSource;
  identifier: Identifier;
  site: string;
  title: string;
  detail: string;
  exposed: string[];
  severity: Severity;
  url?: string;
  date?: string;
  links?: string[];
  removal?: Removal;
};

export type StepId = "breaches" | "profiles" | "web" | "browser" | "analysis";

export type StepStatus = "running" | "done" | "skipped" | "error";

export type ChainLink = { label: string; value: string };

export type Report = {
  score: number;
  level: "Low" | "Moderate" | "High" | "Critical";
  summary: string;
  chain: { links: ChainLink[]; breakAt: string } | null;
  actions: { title: string; detail: string; priority: "now" | "soon" | "later"; findingIds: string[] }[];
  analyzedBy: "gemini" | "claude" | "rules";
  deep?: boolean;
};

export type ScanEvent =
  | { type: "queue"; position: number; etaSeconds: number }
  | { type: "step"; id: StepId; label: string; status: StepStatus; note?: string; count?: number }
  | { type: "finding"; finding: Finding }
  | { type: "report"; report: Report }
  | { type: "error"; message: string }
  | { type: "done" };
