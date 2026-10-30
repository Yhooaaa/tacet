import { currentUser, deleteUser, endSession, listAlerts, listBrokerTasks, listIdentifiers, setMonitoring } from "@/server/auth/account";
import { MONITOR_INTERVAL_DAYS } from "@/server/jobs/monitor";
import { readJson, unauthorized } from "@/server/utils/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const [identifiers, alerts, brokers] = await Promise.all([listIdentifiers(user.id), listAlerts(user.id), listBrokerTasks(user.id)]);
  return Response.json({
    user: { email: user.email, plan: user.plan, monitoring: Boolean(user.monitoring), lastCheckedAt: user.last_checked_at, intervalDays: MONITOR_INTERVAL_DAYS },
    identifiers,
    alerts,
    brokers,
  });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJson<{ monitoring?: unknown }>(request);
  if (typeof body?.monitoring !== "boolean") return Response.json({ error: "Nothing to update." }, { status: 400 });
  await setMonitoring(user.id, body.monitoring);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return unauthorized();
  await deleteUser(user.id);
  await endSession();
  return Response.json({ ok: true });
}
