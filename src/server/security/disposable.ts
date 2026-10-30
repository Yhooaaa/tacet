import "server-only";
import list from "./data/disposable-domains.json";

const DOMAINS = new Set((list as { domains: string[] }).domains);

export function isDisposableEmail(email: string): boolean {
  const parts = email.slice(email.lastIndexOf("@") + 1).toLowerCase().split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DOMAINS.has(parts.slice(i).join("."))) return true;
  return false;
}
