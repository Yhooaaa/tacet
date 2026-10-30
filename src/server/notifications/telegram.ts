import "server-only";
import { config } from "../config";
import { one, run } from "../db";
import { hmac, safeCompare } from "@/server/auth/tokens";

const API = "https://api.telegram.org";

class TelegramError extends Error {
  constructor(readonly code: number, description: string) {
    super(`Telegram API ${code}: ${description}`);
  }
}

async function call<T>(method: string, body: object, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${API}/bot${config.telegram!.token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string; error_code?: number } | null;
  if (!data?.ok) throw new TelegramError(data?.error_code ?? res.status, data?.description ?? `HTTP ${res.status}`);
  return data.result as T;
}

const phoneKey = (phone: string) => hmac(`telegram-phone:+${phone.replace(/\D/g, "")}`);

export const webhookSecret = () => config.telegram?.webhookSecret ?? hmac("telegram-webhook");

let botName: Promise<string> | null = null;

function botUsername(): Promise<string> {
  if (config.telegram?.username) return Promise.resolve(config.telegram.username);
  botName ??= call<{ username: string }>("getMe", {}).then(
    (me) => me.username,
    (error) => {
      botName = null;
      throw error;
    },
  );
  return botName;
}

export async function startTelegramCheck(nonce: string, phone: string, expiresAt: number): Promise<string> {
  const bot = await botUsername();
  const now = Date.now();
  await run("DELETE FROM telegram_checks WHERE expires_at < $1", [now]);
  await run("INSERT INTO telegram_checks (nonce, phone_hash, expires_at) VALUES ($1, $2, $3)", [nonce, phoneKey(phone), expiresAt]);
  return `https://t.me/${bot}?start=${nonce}`;
}

export async function takeTelegramCheck(nonce: string): Promise<"confirmed" | "pending" | "expired"> {
  const taken = await one("DELETE FROM telegram_checks WHERE nonce = $1 AND verified = 1 AND expires_at >= $2 RETURNING nonce", [nonce, Date.now()]);
  if (taken) return "confirmed";
  const row = await one<{ expires_at: number }>("SELECT expires_at FROM telegram_checks WHERE nonce = $1", [nonce]);
  return !row || row.expires_at < Date.now() ? "expired" : "pending";
}

type TelegramMessage = {
  chat: { id: number; type: string };
  from?: { id: number };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
};

export type TelegramUpdate = { update_id?: number; message?: TelegramMessage };

const SHARE_KEYBOARD = { keyboard: [[{ text: "Share my phone number", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
const NO_KEYBOARD = { remove_keyboard: true };

const say = (chat: number, text: string, markup: object = NO_KEYBOARD) =>
  call("sendMessage", { chat_id: chat, text, reply_markup: markup }).catch((error) => console.error("[noise] Telegram reply failed", error));

export async function handleUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message || message.chat.type !== "private") return;
  const chat = message.chat.id;
  const now = Date.now();

  if (message.text?.startsWith("/start")) {
    const nonce = message.text.slice("/start".length).trim();
    if (!nonce) return say(chat, "This bot confirms phone numbers for Tacet. Start on the Tacet website: enter your number there and open the link it gives you.");
    const claimed = await run("UPDATE telegram_checks SET chat_id = $1 WHERE nonce = $2 AND expires_at > $3 AND verified = 0", [chat, nonce, now]);
    if (!claimed) return say(chat, "This link has expired. Go back to Tacet and enter your number again.");
    return say(
      chat,
      "Tap the button below to share this Telegram account's phone number with Tacet. We only use it to confirm it matches the number you entered.",
      SHARE_KEYBOARD,
    );
  }

  if (message.contact) {
    if (!message.from || message.contact.user_id !== message.from.id) {
      return say(chat, "Please share your own number with the button below, not a contact.", SHARE_KEYBOARD);
    }
    const check = await one<{ nonce: string; phone_hash: string }>(
      "SELECT nonce, phone_hash FROM telegram_checks WHERE chat_id = $1 AND expires_at > $2 AND verified = 0 ORDER BY expires_at DESC LIMIT 1",
      [chat, now],
    );
    if (!check) return say(chat, "This link has expired. Go back to Tacet and enter your number again.");
    if (!safeCompare(phoneKey(message.contact.phone_number), check.phone_hash)) {
      return say(chat, "That isn't the number you entered on Tacet. Check the number on the website, or open the link from the Telegram account that uses it.");
    }
    await run("UPDATE telegram_checks SET verified = 1 WHERE nonce = $1", [check.nonce]);
    return say(chat, "Your number is confirmed. Go back to Tacet: it carries on by itself.");
  }

  return say(chat, "Start on the Tacet website: enter your number there and open the link it gives you.");
}

declare global {
  var __noiseTelegram: boolean | undefined;
}

const isPublicHttps = (url: string | undefined) => Boolean(url?.startsWith("https://")) && !/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url!);

export function startTelegram() {
  if (!config.telegram || globalThis.__noiseTelegram) return;
  globalThis.__noiseTelegram = true;
  const appUrl = process.env.NOISE_APP_URL;
  if (isPublicHttps(appUrl)) {
    call("setWebhook", { url: `${appUrl!.replace(/\/$/, "")}/api/telegram/webhook`, secret_token: webhookSecret(), allowed_updates: ["message"] }).then(
      () => console.info("[noise] Telegram webhook set"),
      (error) => console.error("[noise] couldn't set the Telegram webhook; phone verification won't complete", error),
    );
  } else {
    void poll();
  }
}

async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await call<TelegramUpdate[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }, 35_000);
      for (const update of updates) {
        offset = (update.update_id ?? offset) + 1;
        await handleUpdate(update).catch((error) => console.error("[noise] Telegram update failed", error));
      }
    } catch (error) {
      if (error instanceof TelegramError && (error.code === 401 || error.code === 404)) {
        return console.error("[noise] Telegram rejected TELEGRAM_BOT_TOKEN; phone verification is off");
      }
      if (error instanceof TelegramError && error.code === 409) {
        return console.error("[noise] this Telegram bot has a webhook set (probably by your live site); use a separate bot for local development");
      }
      console.warn("[noise] Telegram polling failed; retrying", error instanceof Error ? error.message : error);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
