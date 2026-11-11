// Iniettata con chrome.scripting.executeScript nella scheda Amazon aperta: legge solo il DOM
// già caricato, nessuna richiesta di rete. Deve restare autonoma (niente variabili esterne).
export function readProductPage() {
  const text = (el) => el?.textContent?.trim() || null;
  const title = text(document.querySelector("#productTitle"));
  const img = document.querySelector("#landingImage") || document.querySelector("#imgBlkFront");
  const image = img?.getAttribute("data-old-hires") || img?.getAttribute("src") || null;
  let price = null;
  for (const sel of ["#corePrice_feature_div", "#corePriceDisplay_desktop_feature_div", "#corePrice_desktop"]) {
    price = text(document.querySelector(`${sel} .a-offscreen`));
    if (price) break;
  }
  return { title, image: image && /^https:\/\//.test(image) ? image : null, price };
}
