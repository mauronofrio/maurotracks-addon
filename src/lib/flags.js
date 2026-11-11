// Bandiere SVG (viewBox "0 0 3 2"): le emoji bandiera su Windows diventano solo lettere.
const US_STRIPES = [0, 2, 4, 6, 8, 10, 12]
  .map((i) => `<rect y="${(i * 2) / 13}" width="3" height="${2 / 13}" fill="#b22234"/>`)
  .join("");

export const FLAG_SVG = {
  IT: '<rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/>',
  FR: '<rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/>',
  DE: '<rect width="3" height="0.667" fill="#000"/><rect y="0.667" width="3" height="0.667" fill="#dd0000"/><rect y="1.333" width="3" height="0.667" fill="#ffce00"/>',
  ES: '<rect width="3" height="2" fill="#aa151b"/><rect y="0.5" width="3" height="1" fill="#f1bf00"/>',
  JP: '<rect width="3" height="2" fill="#fff"/><circle cx="1.5" cy="1" r="0.6" fill="#bc002d"/>',
  GB: '<rect width="3" height="2" fill="#012169"/><path d="M0 0L3 2M3 0L0 2" stroke="#fff" stroke-width="0.4"/><path d="M0 0L3 2M3 0L0 2" stroke="#c8102e" stroke-width="0.13"/><path d="M1.5 0V2M0 1H3" stroke="#fff" stroke-width="0.67"/><path d="M1.5 0V2M0 1H3" stroke="#c8102e" stroke-width="0.4"/>',
  US: `<rect width="3" height="2" fill="#fff"/>${US_STRIPES}<rect width="1.2" height="${14 / 13}" fill="#3c3b6e"/>`,
};
