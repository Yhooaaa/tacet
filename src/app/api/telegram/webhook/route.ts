import { config } from "@/server/config";
import { readJson } from "@/server/utils/http";
import { handleUpdate, webhookSecret, type TelegramUpdate } from "@/server/notifications/telegram";
import { safeCompare } from "@/server/auth/tokens";

export async function POST(request: Request) {
  if (!config.telegram) return new Response(null, { status: 404 });
  if (!safeCompare(request.headers.get("x-telegram-bot-api-secret-token") ?? "", webhookSecret())) return new Response(null, { status: 401 });
  const update = await readJson<TelegramUpdate>(request, 64 * 1024);
  if (update) await handleUpdate(update).catch((error) => console.error("[noise] Telegram update failed", error));
  return Response.json({ ok: true });
}
