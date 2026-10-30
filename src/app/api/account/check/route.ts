import { currentUser } from "@/server/auth/account";
import { checkUser } from "@/server/jobs/monitor";
import { rateLimit } from "@/server/security/rate-limit";
import { unauthorized } from "@/server/utils/http";

export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.plan !== "pro") return Response.json({ error: "Monitoring is part of Pro, which isn't open yet." }, { status: 403 });
  if (!rateLimit(`check:${user.id}`, 3, 10 * 60)) {
    return Response.json({ error: "You've checked a few times already. Try again in 10 minutes." }, { status: 429 });
  }
  const result = await checkUser(user);
  if (result.failed) return Response.json({ error: "The breach index didn't respond. Try again in a minute." }, { status: 502 });
  return Response.json(result);
}
