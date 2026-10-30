import { connection } from "next/server";
import { one } from "@/server/db";
import { funnelStats } from "@/server/analytics/funnel";
import { eventLoopStats } from "@/server/utils/metrics";
import { safeCompare } from "@/server/auth/tokens";
import { admissionStats } from "@/server/scan/admission";
import { aiStats } from "@/server/scan/analyze";
import { browserStats } from "@/server/scan/sources/browser-agent";
import { outboundStats } from "@/server/scan/net";
import { unreachableHosts } from "@/server/scan/sources/site-check";

export async function GET(request: Request) {
  await connection();
  const scans = admissionStats();

  let database = true;
  try {
    await one("SELECT 1");
  } catch (error) {
    console.error("[noise] health check: database unavailable", error);
    database = false;
  }

  const healthy = database && !scans.draining;
  const status = scans.draining ? "draining" : healthy ? "ok" : "degraded";
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeCompare(auth, `Bearer ${secret}`)) {
    return Response.json({ status }, { status: healthy ? 200 : 503 });
  }

  const memory = process.memoryUsage();
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  return Response.json(
    {
      status,
      uptimeSeconds: Math.round(process.uptime()),
      database,
      scans,
      outbound: { ...outboundStats(), unreachableHosts: unreachableHosts() },
      browser: browserStats(),
      ai: aiStats(),
      eventLoop: eventLoopStats(),
      memoryMb: { rss: mb(memory.rss), heapUsed: mb(memory.heapUsed), external: mb(memory.external) },
      funnel: await funnelStats(),
    },
    { status: healthy ? 200 : 503 },
  );
}
