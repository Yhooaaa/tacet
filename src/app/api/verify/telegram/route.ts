import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { readJson } from "@/server/utils/http";
import { checkTelegramVerification } from "@/server/auth/verification";

export async function POST(request: Request) {
  if (!rateLimit(`telegram-poll:${clientIp(request)}`, 400, 10 * 60)) {
    return Response.json({ error: "Too many requests. Wait a few minutes and try again." }, { status: 429 });
  }
  const body = await readJson<{ token?: unknown }>(request);
  const result = await checkTelegramVerification(body?.token);
  if ("pending" in result) return Response.json({ pending: true });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ proof: result.proof, identifier: result.identifier });
}
