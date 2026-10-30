import "server-only";
import { config } from "../config";

function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2] } : { email: from.trim() };
}

export async function sendMail(to: string, subject: string, text: string) {
  const mail = config.email;
  if (!mail) throw new Error("No email provider is configured");

  const res =
    mail.provider === "brevo"
      ? await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": mail.apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: parseFrom(mail.from), to: [{ email: to }], subject, textContent: text }),
          signal: AbortSignal.timeout(15_000),
        })
      : await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${mail.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from: mail.from, to, subject, text }),
          signal: AbortSignal.timeout(15_000),
        });
  if (!res.ok) throw new Error(`Email provider (${mail.provider}) returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}
