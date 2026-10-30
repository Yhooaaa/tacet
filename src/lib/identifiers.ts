export type IdentifierKind = "email" | "phone" | "username";

export type Identifier = { kind: IdentifierKind; value: string };

type Detection =
  | { ok: true; identifier: Identifier; note?: string }
  | { ok: false; kind?: IdentifierKind; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,38}$/;

export const KIND_LABEL: Record<IdentifierKind, string> = {
  email: "Email",
  phone: "Phone number",
  username: "Username",
};

export function detectIdentifier(raw: string): Detection {
  const input = raw.trim();
  if (!input) return { ok: false, error: "Enter an email, phone number or username." };

  if (input.includes("@") && !input.startsWith("@")) {
    const email = input.toLowerCase();
    if (EMAIL.test(email)) return { ok: true, identifier: { kind: "email", value: email } };
    return { ok: false, kind: "email", error: "That email address looks incomplete." };
  }

  const compact = input.replace(/[\s().-]/g, "");
  if (/^(\+|00)?\d{6,}$/.test(compact)) {
    let digits = compact.replace(/^\+|^00/, "");
    const international = /^(\+|00)/.test(compact);
    let note: string | undefined;
    if (!international) {
      if (digits.length !== 10) {
        return { ok: false, kind: "phone", error: "Add your country code, for example +44 or +1." };
      }
      digits = `1${digits}`;
      note = "No country code given, so we assumed +1 (US and Canada).";
    }
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, kind: "phone", error: "Phone numbers have 8 to 15 digits including the country code." };
    }
    return { ok: true, identifier: { kind: "phone", value: `+${digits}` }, note };
  }

  const handle = input.replace(/^@/, "");
  if (USERNAME.test(handle)) return { ok: true, identifier: { kind: "username", value: handle } };
  return {
    ok: false,
    kind: "username",
    error: "Usernames can use letters, numbers, dots, dashes and underscores.",
  };
}

export function maskIdentifier({ kind, value }: Identifier): string {
  if (kind === "email") {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}${"•".repeat(Math.max(name.length - 2, 3))}@${domain}`;
  }
  if (kind === "phone") return `${value.slice(0, 3)} ${"•".repeat(Math.max(value.length - 6, 3))}${value.slice(-2)}`;
  return value;
}

export function identifierKey({ kind, value }: Identifier): string {
  return `${kind}:${value}`;
}
