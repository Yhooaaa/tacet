import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { confirmVerification } from "@/server/auth/verification";
import { readJson } from "@/server/utils/http";

export async function POST(request: Request) {
  if (!rateLimit(`confirm:${clientIp(request)}`, 30, 10 * 60)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const body = await readJson<{ token?: unknown; code?: unknown }>(request);
  const result = await confirmVerification(body?.token, body?.code);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ proof: result.proof, identifier: result.identifier });
}
