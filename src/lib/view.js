import { MARKETPLACES } from "./amazon-url.js";

// Quale schermata mostrare in base allo stato ricevuto.
export function decideView({ page, loggedIn, status }) {
  const none = { disabled: [], preselected: [] };
  if (!loggedIn) return { view: "login", ...none };
  if (!page) return { view: "notProduct", ...none };
  if (status && status.hasNotificationMethod === false) return { view: "noNotification", ...none };
  const disabled = (status?.tracked ?? []).map((t) => t.marketplace);
  if (MARKETPLACES.every((m) => disabled.includes(m.tld))) return { view: "allTracked", disabled, preselected: [] };
  return { view: "form", disabled, preselected: disabled.includes(page.marketplace) ? [] : [page.marketplace] };
}

// Schermata da mostrare quando l'aggiunta non riesce.
export function errorView(httpStatus) {
  if (httpStatus === 401) return "login";
  if (httpStatus === 402) return "slotsFull";
  if (httpStatus === 503) return "maintenance";
  return "generic";
}
