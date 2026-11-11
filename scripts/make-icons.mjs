// Icone dell'addon da icons/logo.svg.
// Uso: npm install && node scripts/make-icons.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(here, "../icons/logo.svg"));
for (const size of [16, 32, 48, 128]) {
  await sharp(svg, { density: Math.max(72, (72 * size) / 200) })
    .resize(size, size)
    .png()
    .toFile(path.join(here, `../icons/icon-${size}.png`));
  console.log(`icon-${size}.png`);
}
