# Mauro Tracks Everything — browser add-on

Add-on for Chrome, Firefox and Edge that adds the Amazon product you are looking at to your
price tracking on [maurotracks.com](https://maurotracks.com): ASIN and marketplace are detected
from the page, thresholds are pre-filled with the suggested price.

*Addon per Chrome, Firefox ed Edge che aggiunge il prodotto Amazon che stai guardando al tuo
tracciamento prezzi su [maurotracks.com](https://maurotracks.com).*

## What it does, and what it doesn't

- It runs only when you click its icon. It then reads the address of the active tab and, from
  that Amazon product page, the title, image and price already shown in it.
- It talks **only** to `https://maurotracks.com`, using your existing session on the site.
  It never makes requests to Amazon and contains no keys or secrets.
- It stores only your light/dark theme in the browser. It does not record your browsing.
- Permissions: `activeTab`, `scripting`, `storage`, host `https://maurotracks.com/*`.

Privacy policy: https://maurotracks.com/en/privacy

## Structure

| Path | Content |
|---|---|
| `manifest.json` | Manifest V3 (Chrome, Edge, Firefox) |
| `src/popup.*` | The popup |
| `src/lib/` | Pure logic (URL parsing, translations, view selection), tested with `node --test` |
| `src/page-reader.js` | Reads title, image and price from the open product page |
| `src/theme-sync.js` | Copies the theme chosen on maurotracks.com |
| `_locales/` | Store name and description in 6 languages |
| `icons/` | `logo.svg` and the PNGs generated from it |

## Development

Requires Node 22+.

```sh
npm test                         # unit tests
node scripts/build.mjs           # dist/mte-addon-chrome-<v>.zip and dist/mte-addon-firefox-<v>.zip
npm install && npm run icons   # PNG icons from icons/logo.svg
```

To try it: Chrome/Edge → `chrome://extensions` → Developer mode → *Load unpacked* → this folder.
Firefox → `about:debugging` → This Firefox → *Load Temporary Add-on* → `manifest.json`.

## License

Copyright © 2026 Mauronofrio Matarrese. **All rights reserved** — the code is public for
transparency only; see [LICENSE](LICENSE).
