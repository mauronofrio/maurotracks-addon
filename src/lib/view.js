// Quale schermata mostrare in base allo stato ricevuto: per un prodotto già tracciato
// il modulo parte dai suoi marketplace, altrimenti dal marketplace della pagina.
export function decideView({ page, loggedIn, status }) {
  if (!loggedIn) return { view: "login" };
  if (!page) return { view: "notProduct" };
  if (status && status.hasNotificationMethod === false) return { view: "noNotification" };
  const tracked = (status?.tracked ?? []).map((t) => t.marketplace);
  if (tracked.length > 0) return { view: "form", mode: "edit", preselected: tracked };
  return { view: "form", mode: "add", preselected: [page.marketplace] };
}

// Schermata da mostrare quando l'aggiunta non riesce.
export function errorView(httpStatus) {
  if (httpStatus === 401) return "login";
  if (httpStatus === 402) return "slotsFull";
  if (httpStatus === 503) return "maintenance";
  return "generic";
}
