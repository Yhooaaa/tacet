import type { BrokerStatus } from "@/lib/brokers";
import { BROKER_IDS } from "@/lib/brokers";
import { currentUser, setBrokerStatus } from "@/server/auth/account";
import { readJson, unauthorized } from "@/server/utils/http";

const STATUSES = new Set<BrokerStatus>(["todo", "submitted", "removed", "recheck"]);

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJson<{ brokerId?: unknown; status?: unknown }>(request);
  const brokerId = typeof body?.brokerId === "string" ? body.brokerId : "";
  const status = body?.status as BrokerStatus;
  if (!BROKER_IDS.has(brokerId) || !STATUSES.has(status)) return Response.json({ error: "Unknown broker or status." }, { status: 400 });
  await setBrokerStatus(user.id, brokerId, status);
  return Response.json({ ok: true, updatedAt: Date.now() });
}
