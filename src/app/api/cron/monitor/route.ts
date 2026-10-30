import { safeCompare } from "@/server/auth/tokens";
import { runDueChecks } from "@/server/jobs/monitor";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeCompare(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await runDueChecks());
}
