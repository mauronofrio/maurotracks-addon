import { MARKETPLACES, parseAmazonUrl } from "./lib/amazon-url.js";
import { pickLocale, t } from "./lib/i18n.js";
import { decideView, errorView } from "./lib/view.js";
import { applySuggestion } from "./lib/suggest.js";
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

function formatPrice(value, tld) {
  const currency = MARKETPLACES.find((m) => m.tld === tld)?.currency ?? "EUR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
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
    case "allTracked":
      return show(productBlock(ctx), trackedNote(ctx.status.tracked, "alreadyTracking"));
    case "form":
      return renderForm(ctx);
    default:
      return message(t(locale, "generic"));
  }
}

function productBlock({ page, info }) {
  const img = info?.image ? el("img", { src: info.image, alt: "" }) : el("div", { class: "ph" });
  const meta = [`ASIN ${page.asin}`];
  if (info?.price) meta.push(info.price);
  return el("div", { class: "prod" }, img,
    el("div", {}, el("div", { class: "title" }, info?.title ?? page.asin), el("div", { class: "muted small" }, meta.join(" · "))));
}

function thresholdText(item) {
  const parts = [];
  if (item.thresholdNew != null) parts.push(`${t(locale, "newLabel")} ${formatPrice(item.thresholdNew, item.marketplace)}`);
  if (item.thresholdUsed != null) parts.push(`${t(locale, "usedLabel")} ${formatPrice(item.thresholdUsed, item.marketplace)}`);
  return parts.join(" · ") || t(locale, "noThresholdSet");
}

function trackedNote(tracked, titleKey) {
  const list = el("ul", { class: "tracked" });
  for (const item of tracked) {
    const region = MARKETPLACES.find((m) => m.tld === item.marketplace)?.region;
    const link = el("a", { href: "#", onclick: (e) => { e.preventDefault(); openSite(`/dashboard/product/${item.id}`); } },
      t(locale, "viewOnSite"));
    list.append(el("li", {}, flag(region), el("span", {}, thresholdText(item)), link));
  }
  return el("div", { class: "note" }, el("h2", {}, t(locale, titleKey)), list);
}

function renderForm(ctx) {
  const { page, status, disabled, preselected } = ctx;
  const selected = [...preselected]; // ordine di selezione: il primo decide il suggerimento
  const auto = { new: "", used: "" };
  let suggestTimer = null;

  const error = el("p", { class: "error", hidden: true });
  const slots = el("div", { class: "muted small", style: "margin-top:5px" });
  const updateSlots = () => {
    slots.textContent = t(locale, "slots", { selected: selected.length, free: Math.max(0, status.slots.max - status.slots.used) });
  };

  const grid = el("div", { class: "grid" });
  for (const m of MARKETPLACES) {
    const isDisabled = disabled.includes(m.tld);
    const btn = el("button", {
      type: "button", class: `mk${selected.includes(m.tld) ? " on" : ""}`, disabled: isDisabled,
      title: isDisabled ? t(locale, "alreadyTrackedHint") : `Amazon.${m.tld}`,
    }, flag(m.region), el("span", {}, countryName(m.region)));
    btn.addEventListener("click", () => {
      const i = selected.indexOf(m.tld);
      if (i >= 0) selected.splice(i, 1);
      else selected.push(m.tld);
      btn.classList.toggle("on", i < 0);
      updateSlots();
      scheduleSuggestion();
    });
    grid.append(btn);
  }
  updateSlots();

  const numberInput = (id) => el("input", { id, type: "number", min: "0.01", step: "0.01", inputmode: "decimal" });
  const inNew = numberInput("t-new");
  const inUsed = numberInput("t-used");
  const usedBox = el("div", {}, el("label", { class: "label", for: "t-used" }, t(locale, "thresholdUsed")), inUsed);
  const same = el("input", { type: "checkbox" });
  same.addEventListener("change", () => { usedBox.hidden = same.checked; });

  function scheduleSuggestion() {
    clearTimeout(suggestTimer);
    const mkt = selected[0];
    if (!mkt) return;
    suggestTimer = setTimeout(async () => {
      const res = await api(`/api/products/suggest?asin=${encodeURIComponent(page.asin)}&marketplace=${encodeURIComponent(mkt)}`)
        .catch(() => null);
      if (!res?.ok || selected[0] !== mkt) return;
      const n = applySuggestion(inNew.value, auto.new, res.body?.new ?? null);
      const u = applySuggestion(inUsed.value, auto.used, res.body?.used ?? null);
      inNew.value = n.value; auto.new = n.lastAuto;
      inUsed.value = u.value; auto.used = u.lastAuto;
    }, 300);
  }

  const submit = el("button", { class: "btn", type: "submit" }, t(locale, "add"));
  const form = el("form", {},
    el("div", {}, el("span", { class: "label" }, t(locale, "marketplaces")), grid, slots),
    el("div", { class: "row" },
      el("div", {}, el("label", { class: "label", for: "t-new" }, t(locale, "thresholdNew")), inNew),
      usedBox),
    el("label", { class: "check" }, same, t(locale, "sameThreshold")),
    error, submit);
  form.style.cssText = "display:flex;flex-direction:column;gap:11px";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fail = (key) => { error.textContent = t(locale, key); error.hidden = false; };
    if (selected.length === 0) return fail("errNoMarketplace");
    if (!inNew.value && !(inUsed.value && !same.checked)) return fail("errNoThreshold");
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = t(locale, "adding");
    const thresholdNew = inNew.value ? parseFloat(inNew.value) : null;
    const thresholdUsed = same.checked ? thresholdNew : inUsed.value ? parseFloat(inUsed.value) : null;
    const res = await api("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: page.asin, marketplaces: selected, thresholdNew, thresholdUsed }),
    }).catch(() => ({ status: 0, ok: false, body: null }));
    if (!res.ok) {
      const view = errorView(res.status);
      if (view !== "generic") return renderView(view, ctx);
      submit.disabled = false;
      submit.textContent = t(locale, "add");
      return fail("generic");
    }
    renderAdded(ctx, selected[0]);
  });

  const nodes = [productBlock(ctx)];
  if (status.tracked.length > 0) nodes.push(trackedNote(status.tracked, "partialTracking"));
  nodes.push(form);
  show(...nodes);
  scheduleSuggestion();
}

async function renderAdded(ctx, firstMkt) {
  const res = await api(statusPath(ctx.page)).catch(() => null);
  const item = res?.ok ? res.body.tracked.find((x) => x.marketplace === firstMkt) : null;
  show(productBlock(ctx),
    el("div", { class: "note center" }, el("h2", {}, t(locale, "added")), el("p", { class: "muted small", style: "margin:0" }, t(locale, "addedHint"))),
    linkButton(t(locale, "viewProduct"), item ? `/dashboard/product/${item.id}` : "/dashboard"));
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
  const info = decision.view === "form" || decision.view === "allTracked" ? await readPage(tab.id) : null;
  renderView(decision.view, { page, status: res.body, info, ...decision });
}

start();
