import { endSession } from "@/server/auth/account";

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
