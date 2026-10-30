import "server-only";
import { config } from "./config";
import { startDraining } from "./scan/admission";

const isLocal = (url: string | undefined) => !url || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);

function checkStartup() {
  const production = process.env.NODE_ENV === "production";
  const appUrl = process.env.NOISE_APP_URL;

  if (production && process.env.NOISE_DEV_MODE === "1" && !isLocal(appUrl)) {
    throw new Error(`NOISE_DEV_MODE=1 on a public deployment (${appUrl}). Remove it before starting.`);
  }
  if (!config.devMode && (!config.secret || config.secret.length < 32)) {
    throw new Error("NOISE_SECRET must be set to at least 32 random characters. Generate one with: openssl rand -hex 32");
  }

  if (!production) return;
  const missing = [
    !config.email && "BREVO_API_KEY or RESEND_API_KEY (email codes and alerts can't be sent)",
    !config.telegram && !config.twilio && "TELEGRAM_BOT_TOKEN (phone numbers can't be verified)",
    !config.hibpKey && "HIBP_API_KEY (falling back to XposedOrNot, which isn't licensed for commercial use)",
    !process.env.CRON_SECRET && "CRON_SECRET (monitoring never runs and /api/health shows no metrics)",
    isLocal(appUrl) && "NOISE_APP_URL (links in alert emails point at localhost)",
  ].filter(Boolean);
  if (missing.length) console.warn(`[noise] running without:\n  - ${missing.join("\n  - ")}`);
  if (config.devMode) console.warn("[noise] DEV MODE IS ON: verification codes are shown on screen. Never expose this server publicly.");

  if (process.env.NEXT_MANUAL_SIG_HANDLE) return;
  process.once("SIGTERM", () => {
    console.info("[noise] SIGTERM: draining, no new scans");
    startDraining();
  });
}

export function startOrExit() {
  try {
    checkStartup();
  } catch (error) {
    console.error(`[noise] refusing to start: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
