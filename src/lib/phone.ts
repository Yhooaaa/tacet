import { parsePhoneNumberFromString, type NumberType } from "libphonenumber-js/max";

const TYPE_LABEL: Partial<Record<NonNullable<NumberType>, string>> = {
  MOBILE: "mobile",
  FIXED_LINE: "landline",
  FIXED_LINE_OR_MOBILE: "mobile or landline",
  TOLL_FREE: "toll-free",
  VOIP: "internet (VoIP)",
  PREMIUM_RATE: "premium rate",
  SHARED_COST: "shared cost",
  PERSONAL_NUMBER: "personal number",
  PAGER: "pager",
  UAN: "company number",
  VOICEMAIL: "voicemail",
};

function phoneWrittenForms(value: string): string[] {
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed) return [value];
  const local = parsed.countryCallingCode === "1" ? parsed.nationalNumber.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") : parsed.formatNational();
  return [...new Set([parsed.formatInternational(), local])];
}

export const phoneQuery = (value: string) =>
  phoneWrittenForms(value)
    .map((f) => `"${f}"`)
    .join(" OR ");

let regions: Intl.DisplayNames | null = null;

export function phoneInfo(value: string): string | null {
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.country) return null;
  regions ??= new Intl.DisplayNames(["en"], { type: "region" });
  const type = parsed.getType();
  return [regions.of(parsed.country) ?? parsed.country, type && TYPE_LABEL[type]].filter(Boolean).join(" · ");
}
