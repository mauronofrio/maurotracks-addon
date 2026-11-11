// ASIN e marketplace dall'indirizzo della scheda: nessuna richiesta ad Amazon.

export const MARKETPLACES = Object.freeze([
  { tld: "it", region: "IT" },
  { tld: "de", region: "DE" },
  { tld: "fr", region: "FR" },
  { tld: "es", region: "ES" },
  { tld: "co.uk", region: "GB" },
  { tld: "com", region: "US" },
  { tld: "co.jp", region: "JP" },
]);

const URL_ASIN_REGEX = /(?:dp|gp\/product|product-reviews|ASIN)\/([A-Z0-9]{10})/i;

export function parseAmazonUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const mkt = MARKETPLACES.find((m) => host === `amazon.${m.tld}` || host.endsWith(`.amazon.${m.tld}`));
  if (!mkt) return null;
  const match = u.pathname.match(URL_ASIN_REGEX);
  return match ? { asin: match[1].toUpperCase(), marketplace: mkt.tld } : null;
}
