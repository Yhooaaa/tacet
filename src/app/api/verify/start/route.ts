import { detectIdentifier } from "@/lib/identifiers";
import { currentUser } from "@/server/auth/account";
import { config } from "@/server/config";
import { isDisposableEmail } from "@/server/security/disposable";
import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { freeScanUsed, QUOTA_MESSAGE } from "@/server/scan/quota";
import { startVerification } from "@/server/auth/verification";
import { readJson } from "@/server/utils/http";
import { countStep } from "@/server/analytics/funnel";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`start:${ip}`, 10, 10 * 60)) {
    return Response.json({ error: "Too many requests. Wait a few minutes and try again." }, { status: 429 });
  }

  const body = await readJson<{ value?: unknown; purpose?: unknown }>(request);
  const detection = detectIdentifier(typeof body?.value === "string" ? body.value : "");
  if (!detection.ok) return Response.json({ error: detection.error }, { status: 400 });
  const { identifier } = detection;
  const signIn = body?.purpose === "signin";
  if (signIn && identifier.kind !== "email") return Response.json({ error: "Sign in with an email address." }, { status: 400 });

  if (identifier.kind === "email" && isDisposableEmail(identifier.value)) {
    return Response.json({ error: "Use an email address you keep. Disposable inboxes can't be scanned or used to sign in." }, { status: 400 });
  }

  if (!signIn) {
    const used = await freeScanUsed(ip, [identifier], await currentUser());
    if (used) return Response.json({ error: QUOTA_MESSAGE[used], quota: true }, { status: 402 });
  }

  if (identifier.kind === "phone" && !config.telegram && (!rateLimit(`sms:${ip}`, 3, 24 * 60 * 60) || !rateLimit("sms:all", Number(process.env.NOISE_SMS_PER_HOUR ?? 100), 60 * 60))) {
    return Response.json({ error: "We can't send more texts right now. Try again tomorrow, or verify an email instead." }, { status: 429 });
  }

  if (!rateLimit(`target:${identifier.kind}:${identifier.value}`, 3, 10 * 60)) {
    return Response.json({ error: "We've sent several codes already. Wait 10 minutes and try again." }, { status: 429 });
  }

  const result = await startVerification(identifier);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  if (!signIn) await countStep("verify_started");

  return Response.json({
    identifier,
    note: detection.note,
    token: result.token,
    method: result.method,
    code: result.code,
    devCode: result.devCode,
    link: result.link,
    dev: config.devMode,
  });
}
