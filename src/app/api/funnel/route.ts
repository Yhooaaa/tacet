import { CLIENT_STEPS, countStep, type FunnelStep } from "@/server/analytics/funnel";
import { readJson } from "@/server/utils/http";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

export async function POST(request: Request) {
  if (!rateLimit(`funnel:${clientIp(request)}`, 20, 60 * 60)) return new Response(null, { status: 204 });
  const body = await readJson<{ step?: unknown }>(request, 256);
  const step = body?.step as FunnelStep;
  if (CLIENT_STEPS.has(step)) await countStep(step);
  return new Response(null, { status: 204 });
}
