import { MARKETPLACES, parseAmazonUrl } from "./lib/amazon-url.js";
import { pickLocale, t } from "./lib/i18n.js";
import { decideView, errorView } from "./lib/view.js";
import { applySuggestion } from "./lib/suggest.js";
import { planChanges, toThresholds, validateRows } from "./lib/changes.js";
import { FLAG_SVG } from "./lib/flags.js";
import { readProductPage } from "./page-reader.js";

const SITE = "https://maurotracks.com";

const main = document.getElementById("main");
let locale = pickLocale(null, navigator.language);

// --- utilità DOM (testo sempre via textContent, mai HTML da pagina o server) ---

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function flag(region) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 3 2");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = FLAG_SVG[region] ?? ""; // solo costanti di lib/flags.js
  return svg;
}

function countryName(region) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

function openSite(path) {
  chrome.tabs.create({ url: `${SITE}/${locale}${path}` });
  window.close();
}

function linkButton(text, path) {
  return el("button", { class: "btn", type: "button", onclick: () => openSite(path) }, text);
}

function show(...nodes) {
  main.replaceChildren(...nodes);
}

function message(text, action) {
  show(el("p", { class: "center" }, text), action);
}

// --- chiamate al sito ---

async function api(path, init = {}) {
  const res = await fetch(`${SITE}${path}`, { credentials: "include", cache: "no-store", ...init });
  let body = null;
  try {
    body = await res.json();
  } catch { /* corpo non JSON */ }
  return { status: res.status, ok: res.ok, body };
}

const statusPath = (page) =>
  `/api/extension/status?asin=${encodeURIComponent(page.asin)}&marketplace=${encodeURIComponent(page.marketplace)}`;

// --- tema ---

async function initTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  setTheme(theme === "light" ? "light" : "dark", false);
  document.getElementById("theme").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
}

function setTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  if (persist) chrome.storage.local.set({ theme });
  applyHeaderTexts();
}

function applyHeaderTexts() {
  document.documentElement.lang = locale;
  const dark = document.documentElement.dataset.theme === "dark";
  const themeBtn = document.getElementById("theme");
  themeBtn.title = t(locale, dark ? "themeLight" : "themeDark");
  themeBtn.setAttribute("aria-label", themeBtn.title);
  const dash = document.getElementById("dashboard");
  dash.title = t(locale, "openDashboard");
  dash.setAttribute("aria-label", dash.title);
}

// --- viste ---

function renderView(view, ctx) {
  switch (view) {
    case "login":
      return show(el("p", { class: "center" }, t(locale, "loginHint")), linkButton(t(locale, "login"), "/auth/login"));
    case "notProduct":
      return message(t(locale, "notProduct"), linkButton(t(locale, "goDashboard"), "/dashboard"));
    case "noNotification":
      return message(t(locale, "noNotification"), linkButton(t(locale, "setupNotifications"), "/dashboard/notifications"));
    case "slotsFull":
      return message(t(locale, "slotsFull"), linkButton(t(locale, "seePlans"), "/dashboard/billing"));
    case "maintenance":
      return message(t(locale, "maintenance"));
    case "form":
      return renderForm(ctx);
    default:
      return message(t(locale, "generic"), linkButton(t(locale, "goDashboard"), "/dashboard"));
  }
}

function productBlock({ page, info }) {
  const img = info?.image ? el("img", { src: info.image, alt: "" }) : el("div", { class: "ph" });
  const meta = [`ASIN ${page.asin}`];
  if (info?.price) meta.push(info.price);
  return el("div", { class: "prod" }, img,
    el("div", {}, el("div", { class: "title" }, info?.title ?? page.asin), el("div", { class: "muted small" }, meta.join(" · "))));
}

function doneView(ctx, titleKey, hintKey, path) {
  show(productBlock(ctx),
    el("div", { class: "note center" }, el("h2", {}, t(locale, titleKey)), el("p", { class: "muted small", style: "margin:0" }, t(locale, hintKey))),
    linkButton(t(locale, path === "/dashboard" ? "goDashboard" : "viewProduct"), path));
}

const regionOf = (tld) => MARKETPLACES.find((m) => m.tld === tld)?.region;
const priceField = (v) => (v == null ? "" : Number(v).toFixed(2));

// Riquadro di conferma dentro il popup (niente finestre di dialogo del browser).
function confirmBox(text, onConfirm, onCancel) {
  const box = el("div", { class: "note" }, el("p", { style: "margin:0 0 8px" }, text));
  box.append(el("div", { class: "row" },
    el("div", {}, el("button", { class: "btn btn-ghost", type: "button", onclick: onCancel }, t(locale, "cancel"))),
    el("div", {}, el("button", { class: "btn", type: "button", onclick: onConfirm }, t(locale, "confirm")))));
  return box;
}

function renderForm(ctx) {
  const { page, status, mode, preselected } = ctx;
  const tracked = new Map(status.tracked.map((x) => [x.marketplace, x]));
  const selected = new Set(preselected);
  const rows = new Map(); // marketplace → { node, inNew, inUsed, auto }

  const error = el("p", { class: "error", hidden: true });
  const fail = (text) => { error.textContent = text; error.hidden = false; };
  const slots = el("div", { class: "muted small", style: "margin-top:5px" });
  const updateSlots = () => {
    slots.textContent = t(locale, "slots", { selected: selected.size, free: Math.max(0, status.slots.max - status.slots.used) });
  };

  const same = el("input", { type: "checkbox" });
  const rowsBox = el("div", { class: "trows" });
  const header = el("div", { class: "trow thead" }, el("span", {}),
    el("span", { class: "label" }, t(locale, "thresholdNew")), el("span", { class: "label col-used" }, t(locale, "thresholdUsed")));

  const numberInput = (label) => el("input", { type: "number", min: "0.01", step: "0.01", inputmode: "decimal", "aria-label": label });

  async function suggest(tld, row) {
    const res = await api(`/api/products/suggest?asin=${encodeURIComponent(page.asin)}&marketplace=${encodeURIComponent(tld)}`)
      .catch(() => null);
    if (!res?.ok || rows.get(tld) !== row) return;
    const n = applySuggestion(row.inNew.value, row.auto.new, res.body?.new ?? null);
    const u = applySuggestion(row.inUsed.value, row.auto.used, res.body?.used ?? null);
    row.inNew.value = n.value; row.auto.new = n.lastAuto;
    row.inUsed.value = u.value; row.auto.used = u.lastAuto;
  }

  function addRow(tld) {
    const name = countryName(regionOf(tld));
    const row = {
      inNew: numberInput(`${t(locale, "thresholdNew")} ${name}`),
      inUsed: numberInput(`${t(locale, "thresholdUsed")} ${name}`),
      auto: { new: "", used: "" },
    };
    row.node = el("div", { class: "trow" },
      el("span", { class: "tname" }, flag(regionOf(tld)), el("span", {}, name)), row.inNew, el("span", { class: "col-used" }, row.inUsed));
    const cur = tracked.get(tld);
    if (cur) {
      row.inNew.value = priceField(cur.thresholdNew);
      row.inUsed.value = priceField(cur.thresholdUsed);
    } else {
      suggest(tld, row);
    }
    rows.set(tld, row);
  }

  function renderRows() {
    const order = MARKETPLACES.map((m) => m.tld).filter((tld) => selected.has(tld));
    rowsBox.replaceChildren(...(order.length ? [header] : []), ...order.map((tld) => rows.get(tld).node));
  }

  const grid = el("div", { class: "grid" });
  for (const m of MARKETPLACES) {
    const btn = el("button", { type: "button", class: `mk${selected.has(m.tld) ? " on" : ""}`, title: `Amazon.${m.tld}` },
      flag(m.region), el("span", {}, countryName(m.region)));
    btn.addEventListener("click", () => {
      if (selected.has(m.tld)) {
        selected.delete(m.tld);
        rows.delete(m.tld);
      } else {
        selected.add(m.tld);
        addRow(m.tld);
      }
      btn.classList.toggle("on", selected.has(m.tld));
      error.hidden = true;
      updateSlots();
      renderRows();
    });
    grid.append(btn);
  }
  for (const tld of selected) addRow(tld);
  renderRows();
  updateSlots();
  same.addEventListener("change", () => rowsBox.classList.toggle("same", same.checked));

  const submit = el("button", { class: "btn", type: "submit" }, t(locale, mode === "edit" ? "save" : "add"));
  const actions = el("div", { class: "actions" }, submit);
  const stop = mode === "edit" ? el("button", { class: "btn btn-ghost danger", type: "button" }, t(locale, "stopTracking")) : null;
  if (stop) actions.append(stop);

  const busy = (on) => {
    submit.disabled = on;
    if (stop) stop.disabled = on;
    submit.textContent = t(locale, on ? (mode === "edit" ? "saving" : "adding") : (mode === "edit" ? "save" : "add"));
  };
  const restoreActions = () => { actions.replaceChildren(submit, ...(stop ? [stop] : [])); };

  // Esegue le operazioni una alla volta: prima le rimozioni (liberano slot), poi modifiche e aggiunte.
  async function run(plan) {
    busy(true);
    const send = (path, method, body) => api(path, {
      method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    }).catch(() => ({ status: 0, ok: false }));
    const steps = [
      ...plan.remove.map((id) => () => send(`/api/products/${encodeURIComponent(id)}`, "DELETE")),
      ...plan.update.map((u) => () => send(`/api/products/${encodeURIComponent(u.id)}`, "PATCH",
        { thresholdNew: u.thresholdNew, thresholdUsed: u.thresholdUsed })),
      ...plan.add.map((a) => () => send("/api/products", "POST",
        { input: page.asin, marketplaces: [a.marketplace], thresholdNew: a.thresholdNew, thresholdUsed: a.thresholdUsed })),
    ];
    for (const step of steps) {
      const res = await step();
      if (!res.ok) return renderView(errorView(res.status), ctx);
    }
    return true;
  }

  async function productPath(tld) {
    const res = await api(statusPath(page)).catch(() => null);
    const item = res?.ok ? res.body.tracked.find((x) => x.marketplace === tld) ?? res.body.tracked[0] : null;
    return item ? `/dashboard/product/${item.id}` : "/dashboard";
  }

  async function apply(plan) {
    if ((await run(plan)) !== true) return;
    const first = MARKETPLACES.map((m) => m.tld).find((tld) => selected.has(tld));
    const path = await productPath(first);
    if (mode === "edit") doneView(ctx, "saved", "savedHint", path);
    else doneView(ctx, "added", "addedHint", path);
  }

  const form = el("form", { class: "stack" },
    el("div", {}, el("span", { class: "label" }, t(locale, "marketplaces")), grid, slots),
    rowsBox,
    el("label", { class: "check" }, same, t(locale, "sameThreshold")),
    error, actions);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    error.hidden = true;
    const values = MARKETPLACES.map((m) => m.tld).filter((tld) => selected.has(tld)).map((tld) => {
      const r = rows.get(tld);
      return { marketplace: tld, ...toThresholds({ new: r.inNew.value, used: r.inUsed.value }, same.checked) };
    });
    const invalid = validateRows(values);
    if (invalid) {
      return fail(t(locale, invalid.error, { country: invalid.marketplace ? countryName(regionOf(invalid.marketplace)) : "" }));
    }
    const plan = planChanges(status.tracked, values);
    if (!plan.add.length && !plan.update.length && !plan.remove.length) return fail(t(locale, "noChanges"));
    if (!plan.remove.length) return apply(plan);
    const removed = status.tracked.filter((x) => plan.remove.includes(x.id)).map((x) => countryName(regionOf(x.marketplace)));
    actions.replaceChildren(confirmBox(t(locale, "confirmRemove", { list: removed.join(", ") }),
      () => { restoreActions(); apply(plan); }, restoreActions));
  });

  stop?.addEventListener("click", () => {
    error.hidden = true;
    actions.replaceChildren(confirmBox(t(locale, "confirmStop"), async () => {
      restoreActions();
      const plan = { add: [], update: [], remove: status.tracked.map((x) => x.id) };
      if ((await run(plan)) === true) doneView(ctx, "stopped", "stoppedHint", "/dashboard");
    }, restoreActions));
  });

  const nodes = [productBlock(ctx)];
  if (mode === "edit") nodes.push(el("p", { class: "muted small", style: "margin:0" }, t(locale, "editHint")));
  nodes.push(form);
  show(...nodes);
}

// --- avvio ---

async function readPage(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: readProductPage });
    return res?.result ?? null;
  } catch {
    return null; // la pagina non si lascia leggere: il popup mostra solo l'ASIN
  }
}

async function start() {
  document.getElementById("dashboard").addEventListener("click", () => openSite("/dashboard"));
  await initTheme();
  show(el("p", { class: "muted center" }, t(locale, "loading")));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const page = parseAmazonUrl(tab?.url);
  if (!page) return renderView(decideView({ page: null, loggedIn: true, status: null }).view);

  const res = await api(statusPath(page)).catch(() => null);
  if (!res) return renderView("generic");
  if (res.status === 401) return renderView("login");
  if (!res.ok) return renderView(res.status === 503 ? "maintenance" : "generic");

  locale = pickLocale(res.body.locale, navigator.language);
  applyHeaderTexts();
  const decision = decideView({ page, loggedIn: true, status: res.body });
  const info = decision.view === "form" ? await readPage(tab.id) : null;
  renderView(decision.view, { page, status: res.body, info, ...decision });
}

start();
