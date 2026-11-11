// Dalle righe del modulo (una per marketplace selezionato) alle operazioni da inviare al sito.

const num = (v) => (v === "" || v == null ? null : parseFloat(v));

// Valori dei campi di una riga → soglie; con "stessa soglia" l'usato copia il nuovo.
export function toThresholds(fields, same) {
  const thresholdNew = num(fields.new);
  return { thresholdNew, thresholdUsed: same ? thresholdNew : num(fields.used) };
}

const valid = (v) => v != null && Number.isFinite(v) && v > 0;
const invalid = (v) => v != null && !valid(v);

export function validateRows(rows) {
  if (rows.length === 0) return { error: "errNoMarketplace" };
  for (const r of rows) {
    const none = !valid(r.thresholdNew) && !valid(r.thresholdUsed);
    if (none || invalid(r.thresholdNew) || invalid(r.thresholdUsed)) {
      return { error: "errRowThreshold", marketplace: r.marketplace };
    }
  }
  return null;
}

const same = (a, b) => (a == null ? null : Number(a)) === (b == null ? null : Number(b));

export function planChanges(tracked, rows) {
  const byMkt = new Map(tracked.map((t) => [t.marketplace, t]));
  const add = [];
  const update = [];
  for (const r of rows) {
    const cur = byMkt.get(r.marketplace);
    const values = { thresholdNew: r.thresholdNew, thresholdUsed: r.thresholdUsed };
    if (!cur) add.push({ marketplace: r.marketplace, ...values });
    else if (!same(cur.thresholdNew, r.thresholdNew) || !same(cur.thresholdUsed, r.thresholdUsed)) {
      update.push({ id: cur.id, ...values });
    }
  }
  const selected = new Set(rows.map((r) => r.marketplace));
  const remove = tracked.filter((t) => !selected.has(t.marketplace)).map((t) => t.id);
  return { add, update, remove };
}

// "Stessa soglia per tutti i marketplace": una sola coppia di soglie per ogni marketplace selezionato.
export function sharedRows(marketplaces, thresholds) {
  return marketplaces.map((marketplace) => ({ marketplace, ...thresholds }));
}

// La casella "stessa soglia per tutti" parte spuntata, tranne quando il prodotto è già tracciato
// con soglie diverse tra le nazioni: salvando, le renderebbe tutte uguali.
export function startShared(tracked) {
  return tracked.every((t) => same(t.thresholdNew, tracked[0].thresholdNew) && same(t.thresholdUsed, tracked[0].thresholdUsed));
}
