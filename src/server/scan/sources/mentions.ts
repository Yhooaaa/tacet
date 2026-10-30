import "server-only";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { Identifier } from "@/lib/identifiers";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function mentionsIdentifier(id: Identifier, ...parts: string[]): boolean {
  const hay = parts.join(" ").toLowerCase();
  if (id.kind === "email") {
    const email = escapeRe(id.value.toLowerCase());
    return new RegExp(`(?<![a-z0-9._%+-])${email}(?![a-z0-9-]|\\.[a-z0-9])`).test(hay);
  }
  if (id.kind === "phone") {
    const national = parsePhoneNumberFromString(id.value)?.nationalNumber ?? id.value.replace(/\D/g, "").slice(-9);
    return hay.replace(/[\s().+\-/ ]/g, "").includes(national);
  }
  return hay.includes(id.value.toLowerCase());
}
