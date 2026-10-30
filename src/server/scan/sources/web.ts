import "server-only";
import type { Finding } from "@/types/scan";
import type { Identifier } from "@/lib/identifiers";
import { phoneQuery } from "@/lib/phone";
import { mentionsIdentifier } from "./mentions";
import { config } from "@/server/config";
import { requestSignal } from "../context";
import { outbound, scanFetch } from "../net";

type BraveResult = { title: string; url: string; description?: string };

function queryFor({ kind, value }: Identifier): string {
  if (kind === "phone") {
    return phoneQuery(value);
  }
  return `"${value}"`;
}

export async function searchWeb(identifier: Identifier): Promise<Finding[] | null> {
  if (!config.braveKey) return null;
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", queryFor(identifier));
  url.searchParams.set("count", "10");
  url.searchParams.set("safesearch", "off");
  const braveKey = config.braveKey;
  const data = await outbound(url, async () => {
    const res = await scanFetch(url, {
      headers: { accept: "application/json", "x-subscription-token": braveKey },
      signal: requestSignal(12000),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Search returned ${res.status}`);
    }
    return (await res.json()) as { web?: { results?: BraveResult[] } };
  });
  return (data.web?.results ?? [])
    .filter((r) => mentionsIdentifier(identifier, r.title, r.description ?? "", r.url))
    .slice(0, 8)
    .map((r) => {
      const host = new URL(r.url).hostname.replace(/^www\./, "");
      return {
        id: `web:${r.url}`,
        source: "web" as const,
        identifier,
        site: host,
        title: `Mentioned on ${host}`,
        detail: (r.description ?? r.title).replace(/<[^>]+>/g, ""),
        exposed: [identifier.kind === "phone" ? "Phone number" : identifier.kind === "email" ? "Email" : "Username"],
        severity: identifier.kind === "username" ? ("low" as const) : ("medium" as const),
        url: r.url,
      };
    });
}
