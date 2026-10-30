import "server-only";

const env = process.env;

const DEV_MODE = env.NOISE_DEV_MODE === "1" || env.NODE_ENV !== "production";

export const config = {
  devMode: DEV_MODE,
  demoMode: env.NOISE_DEMO_MODE === "1",
  secret: env.NOISE_SECRET,
  email: env.BREVO_API_KEY
    ? { provider: "brevo" as const, apiKey: env.BREVO_API_KEY, from: env.NOISE_EMAIL_FROM ?? "Tacet <verify@tacet.app>" }
    : env.RESEND_API_KEY
      ? { provider: "resend" as const, apiKey: env.RESEND_API_KEY, from: env.NOISE_EMAIL_FROM ?? "Tacet <verify@tacet.app>" }
      : null,
  twilio:
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM
      ? { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM }
      : null,
  hibpKey: env.HIBP_API_KEY ?? null,
  braveKey: env.BRAVE_SEARCH_API_KEY ?? null,
  githubToken: env.GITHUB_TOKEN ?? null,
  telegram: env.TELEGRAM_BOT_TOKEN
    ? { token: env.TELEGRAM_BOT_TOKEN, username: env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null, webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || null }
    : null,
  gemini: env.GEMINI_API_KEY ? { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-flash-latest" } : null,
  anthropic: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
};

export const USER_AGENT = "Mozilla/5.0 (compatible; TacetScanner/0.1; +https://tacet.app/scanner)";
