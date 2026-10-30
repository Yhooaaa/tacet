import { after } from "next/server";
import { findOrCreateUser, startSession } from "@/server/auth/account";
import { checkUser } from "@/server/jobs/monitor";
import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { confirmVerification } from "@/server/auth/verification";
import { readJson } from "@/server/utils/http";

export async function POST(request: Request) {
  if (!rateLimit(`signin:${clientIp(request)}`, 20, 10 * 60)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }
  const body = await readJson<{ token?: unknown; code?: unknown }>(request);
  const result = await confirmVerification(body?.token, body?.code);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  if (result.identifier.kind !== "email") return Response.json({ error: "Sign in with an email address." }, { status: 400 });

  const user = await findOrCreateUser(result.identifier.value);
  await startSession(user.id);
  if (user.last_checked_at === null) after(() => checkUser(user).catch((e) => console.error("[noise] first check failed", e)));
  return Response.json({ ok: true });
}
