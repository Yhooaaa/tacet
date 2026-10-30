export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startOrExit } = await import("@/server/startup");
  startOrExit();
  const { connectDatabase } = await import("@/server/db");
  connectDatabase().catch((error) => console.error("[noise] database unavailable at startup", error));
  const { startTelegram } = await import("@/server/notifications/telegram");
  startTelegram();
}
