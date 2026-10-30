import { detectIdentifier } from "@/lib/identifiers";
import { currentUser } from "@/server/auth/account";
import { isDisposableEmail } from "@/server/security/disposable";
import { countStep, reservePro } from "@/server/analytics/funnel";
import { readJson } from "@/server/utils/http";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

const PLACES = new Set(["scan", "dashboard", "pricing"]);

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`waitlist:${ip}`, 5, 60 * 60)) {
    return Response.json({ error: "Too many requests. Try again in a while." }, { status: 429 });
  }

  const body = await readJson<{ email?: unknown; via?: unknown }>(request);
  const user = await currentUser();
  const via = typeof body?.via === "string" && PLACES.has(body.via) ? body.via : "pricing";

  let email = user?.email;
  if (!email) {
    const detection = detectIdentifier(typeof body?.email === "string" ? body.email : "");
    if (!detection.ok || detection.identifier.kind !== "email") return Response.json({ error: "Enter your email address." }, { status: 400 });
    email = detection.identifier.value;
  }
  if (isDisposableEmail(email)) return Response.json({ error: "Use an email address you keep, so we can reach you at launch." }, { status: 400 });

  if (await reservePro(email, via)) await countStep("pro_reserved");
  return Response.json({ ok: true, email });
}
