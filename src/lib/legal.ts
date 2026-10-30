export const LEGAL = {
  product: "Tacet",
  site: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "tacet-livid.vercel.app",
  entity: null as string | null,
  address: null as string | null,
  registration: null as string | null,
  governingLaw: null as string | null,
  updated: "October 27, 2026",
  minimumAge: 16,
  email: {
    hello: "tacetofficialproject@gmail.com",
    privacy: "tacetofficialproject@gmail.com",
    security: "tacetofficialproject@gmail.com",
    legal: "tacetofficialproject@gmail.com",
  },
  hosting: { name: "Vercel" as string | null, location: "European Union (Frankfurt)" },
  paymentProcessor: null as null | { name: string; location: string },
  backupDays: 30,
  privacyResponseDays: 30,
  securityTriageDays: 3,
};

export const SITE_URL = `https://${LEGAL.site}`;
