import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmazonUrl, MARKETPLACES } from "../src/lib/amazon-url.js";

test("MARKETPLACES: i 7 del sito, in ordine", () => {
  assert.deepEqual(MARKETPLACES.map((m) => m.tld), ["it", "de", "fr", "es", "co.uk", "com", "co.jp"]);
});

test("parseAmazonUrl riconosce ASIN e marketplace", () => {
  assert.deepEqual(parseAmazonUrl("https://www.amazon.it/Sony-WH-1000XM5/dp/B09XS7JWHH/ref=sr_1_1?th=1"),
    { asin: "B09XS7JWHH", marketplace: "it" });
  assert.deepEqual(parseAmazonUrl("https://amazon.co.uk/gp/product/b09xs7jwhh"), { asin: "B09XS7JWHH", marketplace: "co.uk" });
  assert.deepEqual(parseAmazonUrl("https://www.amazon.co.jp/dp/B09XS7JWHH"), { asin: "B09XS7JWHH", marketplace: "co.jp" });
  assert.deepEqual(parseAmazonUrl("https://www.amazon.com/dp/B09XS7JWHH"), { asin: "B09XS7JWHH", marketplace: "com" });
  assert.deepEqual(parseAmazonUrl("https://smile.amazon.de/dp/B09XS7JWHH"), { asin: "B09XS7JWHH", marketplace: "de" });
});

test("parseAmazonUrl rifiuta il resto", () => {
  assert.equal(parseAmazonUrl("https://www.amazon.nl/dp/B09XS7JWHH"), null);
  assert.equal(parseAmazonUrl("https://www.amazon.it/s?k=cuffie"), null);
  assert.equal(parseAmazonUrl("https://evil-amazon.it/dp/B09XS7JWHH"), null);
  assert.equal(parseAmazonUrl("https://amazon.it.evil.com/dp/B09XS7JWHH"), null);
  assert.equal(parseAmazonUrl("http://www.amazon.it/dp/B09XS7JWHH"), null);
  assert.equal(parseAmazonUrl("not a url"), null);
  assert.equal(parseAmazonUrl(undefined), null);
});
