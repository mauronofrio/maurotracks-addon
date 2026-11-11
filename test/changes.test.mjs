import { test } from "node:test";
import assert from "node:assert/strict";
import { planChanges, validateRows, toThresholds, sharedRows, startShared } from "../src/lib/changes.js";

const tracked = [
  { id: "a", marketplace: "it", thresholdNew: 1500, thresholdUsed: 1500 },
  { id: "b", marketplace: "de", thresholdNew: 1400, thresholdUsed: null },
];

test("toThresholds: campi vuoti → null, 'stessa soglia' copia il nuovo nell'usato", () => {
  assert.deepEqual(toThresholds({ new: "12.5", used: "" }, false), { thresholdNew: 12.5, thresholdUsed: null });
  assert.deepEqual(toThresholds({ new: "12.5", used: "9" }, true), { thresholdNew: 12.5, thresholdUsed: 12.5 });
  assert.deepEqual(toThresholds({ new: "", used: "9" }, true), { thresholdNew: null, thresholdUsed: null });
});

test("planChanges: aggiunge, modifica solo se cambiato, toglie i deselezionati", () => {
  const rows = [
    { marketplace: "it", thresholdNew: 1500, thresholdUsed: 1500 }, // invariato
    { marketplace: "fr", thresholdNew: 1300, thresholdUsed: null }, // nuovo
  ];
  assert.deepEqual(planChanges(tracked, rows), {
    add: [{ marketplace: "fr", thresholdNew: 1300, thresholdUsed: null }],
    update: [],
    remove: ["b"],
  });
  assert.deepEqual(planChanges(tracked, [
    { marketplace: "it", thresholdNew: 1450, thresholdUsed: 1500 },
    { marketplace: "de", thresholdNew: 1400, thresholdUsed: null },
  ]), { add: [], update: [{ id: "a", thresholdNew: 1450, thresholdUsed: 1500 }], remove: [] });
});

test("planChanges: nessuna modifica → tutto vuoto; prodotto nuovo → solo aggiunte", () => {
  assert.deepEqual(planChanges(tracked, [
    { marketplace: "it", thresholdNew: 1500, thresholdUsed: 1500 },
    { marketplace: "de", thresholdNew: 1400, thresholdUsed: null },
  ]), { add: [], update: [], remove: [] });
  assert.deepEqual(planChanges([], [{ marketplace: "it", thresholdNew: 10, thresholdUsed: null }]),
    { add: [{ marketplace: "it", thresholdNew: 10, thresholdUsed: null }], update: [], remove: [] });
});

test("validateRows: almeno un marketplace e una soglia valida per riga", () => {
  assert.deepEqual(validateRows([]), { error: "errNoMarketplace" });
  assert.deepEqual(validateRows([{ marketplace: "it", thresholdNew: 10, thresholdUsed: null }]), null);
  assert.deepEqual(validateRows([
    { marketplace: "it", thresholdNew: 10, thresholdUsed: null },
    { marketplace: "co.uk", thresholdNew: null, thresholdUsed: null },
  ]), { error: "errRowThreshold", marketplace: "co.uk" });
  assert.deepEqual(validateRows([{ marketplace: "it", thresholdNew: -1, thresholdUsed: null }]),
    { error: "errRowThreshold", marketplace: "it" });
});

test("sharedRows: la stessa soglia per ogni marketplace selezionato", () => {
  assert.deepEqual(sharedRows(["it", "co.uk"], { thresholdNew: 10, thresholdUsed: null }), [
    { marketplace: "it", thresholdNew: 10, thresholdUsed: null },
    { marketplace: "co.uk", thresholdNew: 10, thresholdUsed: null },
  ]);
  assert.deepEqual(sharedRows([], { thresholdNew: 10, thresholdUsed: 5 }), []);
});

test("startShared: spuntata per i prodotti nuovi e per soglie già uguali, non per soglie diverse", () => {
  assert.equal(startShared([]), true);
  assert.equal(startShared([{ marketplace: "it", thresholdNew: 10, thresholdUsed: null }]), true);
  assert.equal(startShared([
    { marketplace: "it", thresholdNew: 10, thresholdUsed: 5 },
    { marketplace: "de", thresholdNew: "10.00", thresholdUsed: "5" },
  ]), true);
  assert.equal(startShared(tracked), false);
});
