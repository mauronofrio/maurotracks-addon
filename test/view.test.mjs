import { test } from "node:test";
import assert from "node:assert/strict";
import { decideView, errorView } from "../src/lib/view.js";

const page = { asin: "B09XS7JWHH", marketplace: "it" };
const status = (tracked, hasNotificationMethod = true) => ({
  locale: "it", slots: { used: 1, max: 10 }, hasNotificationMethod,
  tracked: tracked.map((m, i) => ({ id: String(i), marketplace: m, thresholdNew: 10, thresholdUsed: null })),
});
const ALL = ["it", "de", "fr", "es", "co.uk", "com", "co.jp"];

test("decideView: priorità degli stati", () => {
  assert.equal(decideView({ page: null, loggedIn: true, status: null }).view, "notProduct");
  assert.equal(decideView({ page: null, loggedIn: false, status: null }).view, "login");
  assert.equal(decideView({ page, loggedIn: false, status: null }).view, "login");
  assert.equal(decideView({ page, loggedIn: true, status: status(ALL, false) }).view, "noNotification");
});

test("decideView: prodotto nuovo → aggiunta con il marketplace della pagina", () => {
  assert.deepEqual(decideView({ page, loggedIn: true, status: status([]) }),
    { view: "form", mode: "add", preselected: ["it"] });
});

test("decideView: prodotto già tracciato → modifica con i suoi marketplace selezionati", () => {
  assert.deepEqual(decideView({ page, loggedIn: true, status: status(["de"]) }),
    { view: "form", mode: "edit", preselected: ["de"] });
  assert.deepEqual(decideView({ page, loggedIn: true, status: status(ALL) }),
    { view: "form", mode: "edit", preselected: ALL });
});

test("errorView", () => {
  assert.equal(errorView(401, {}), "login");
  assert.equal(errorView(402, {}), "slotsFull");
  assert.equal(errorView(400, { error: "x" }), "generic");
  assert.equal(errorView(400, { upgradeRequired: true }), "generic");
  assert.equal(errorView(503, null), "maintenance");
  assert.equal(errorView(500, "x"), "generic");
  assert.equal(errorView(0, null), "generic");
});
