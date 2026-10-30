export const EARLY_ACCESS_DISCOUNT = 50;

const PRO_MONTHLY_PRICE = 9;

const dollars = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const PRO_PRICE_LABEL = dollars(PRO_MONTHLY_PRICE);
export const EARLY_PRICE_LABEL = dollars((PRO_MONTHLY_PRICE * (100 - EARLY_ACCESS_DISCOUNT)) / 100);

export const PRO_FEATURES = [
  "Deep scan: AI agents search 8 search engines in a real browser",
  "AI analysis that connects what we found into one picture",
  "Data removal from sites and data brokers",
  "Monitoring with an alert when your details turn up in a new breach",
];
