import { test } from "node:test";
import assert from "node:assert/strict";
import { pickLocale, t, MESSAGES, LOCALES } from "../src/lib/i18n.js";

test("pickLocale: account, poi browser, poi inglese", () => {
  assert.equal(pickLocale("de", "it-IT"), "de");
  assert.equal(pickLocale(null, "fr-FR"), "fr");
  assert.equal(pickLocale(null, "nl-NL"), "en");
  assert.equal(pickLocale("xx", "pt-BR"), "pt");
});

test("ogni chiave esiste e non è vuota in tutte le 6 lingue", () => {
  assert.deepEqual(LOCALES, ["it", "en", "de", "fr", "es", "pt"]);
  for (const key of Object.keys(MESSAGES.it)) {
    for (const l of LOCALES) assert.ok(MESSAGES[l][key]?.trim(), `${l}.${key}`);
  }
  for (const l of LOCALES) assert.deepEqual(Object.keys(MESSAGES[l]).sort(), Object.keys(MESSAGES.it).sort(), l);
});

test("t sostituisce i parametri e usa l'italiano per le chiavi mancanti", () => {
  const s = t("it", "slots", { selected: 1, free: 7 });
  assert.ok(s.includes("1") && s.includes("7"));
  assert.equal(t("it", "add"), "Aggiungi al tracciamento");
  assert.equal(t("en", "__missing__"), "__missing__");
});
