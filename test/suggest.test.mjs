import { test } from "node:test";
import assert from "node:assert/strict";
import { applySuggestion } from "../src/lib/suggest.js";

test("applySuggestion compila i campi vuoti o ancora suggeriti", () => {
  assert.deepEqual(applySuggestion("", "", 264.9), { value: "264.90", lastAuto: "264.90" });
  assert.deepEqual(applySuggestion("264.90", "264.90", 250), { value: "250.00", lastAuto: "250.00" });
  assert.deepEqual(applySuggestion("264.90", "264.90", null), { value: "", lastAuto: "" });
});

test("applySuggestion non tocca un valore scritto a mano", () => {
  assert.deepEqual(applySuggestion("200", "264.90", 250), { value: "200", lastAuto: "250.00" });
});
