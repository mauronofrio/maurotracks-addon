// Soglia suggerita: il campo si aggiorna solo se è vuoto o contiene ancora il suggerimento precedente.
export function applySuggestion(current, lastAuto, suggested) {
  const next = suggested != null ? Number(suggested).toFixed(2) : "";
  const value = current === "" || current === lastAuto ? next : current;
  return { value, lastAuto: next };
}
