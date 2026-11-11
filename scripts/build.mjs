// Pacchetti per gli store: dist/mte-addon-chrome-<v>.zip (Chrome Web Store, Edge)
// e dist/mte-addon-firefox-<v>.zip. Uso: node scripts/build.mjs
// Zip con il tar di sistema (bsdtar, incluso in Windows 10+): percorsi con "/", come chiede AMO.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Su Windows il primo "tar" nel PATH può essere quello GNU di Git: serve bsdtar di sistema.
const TAR = process.platform === "win32" ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const INCLUDE = ["src", "_locales", "icons"];
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));

function pack(target, manifestFor) {
  const stage = path.join(dist, `stage-${target}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const dir of INCLUDE) cpSync(path.join(root, dir), path.join(stage, dir), { recursive: true });
  writeFileSync(path.join(stage, "manifest.json"), JSON.stringify(manifestFor, null, 2) + "\n");
  const zip = path.join(dist, `mte-addon-${target}-${manifest.version}.zip`);
  rmSync(zip, { force: true });
  execFileSync(TAR, ["-a", "-c", "-f", zip, "manifest.json", ...INCLUDE], { cwd: stage });
  rmSync(stage, { recursive: true, force: true });
  console.log(path.relative(root, zip));
}

mkdirSync(dist, { recursive: true });
const { browser_specific_settings, ...chromeManifest } = manifest;
pack("chrome", chromeManifest);
pack("firefox", manifest);
