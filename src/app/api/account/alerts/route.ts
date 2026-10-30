import { currentUser, markAlertsRead } from "@/server/auth/account";
import { unauthorized } from "@/server/utils/http";

export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized();
  await markAlertsRead(user.id);
  return Response.json({ ok: true });
}
