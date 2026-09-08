#!/usr/bin/env node
// Corre wrangler con el token de desarrollo, sin que el token toque la linea de
// comandos. Se lee de `.claude/ACCESO.local.md` (ignorado por git) en tiempo de
// ejecucion y viaja a wrangler por variable de entorno del proceso hijo.
//
//   node scripts/cf.mjs d1 list
//   node scripts/cf.mjs d1 create markidev
//   node scripts/cf.mjs d1 migrations apply markidev --remote
//
// Un secreto interpolado en el comando queda en el historial de la shell y en
// cualquier transcript. Por eso este rodeo.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const rutaAccesos = join(raiz, ".claude", "ACCESO.local.md");

let contenido;
try {
  contenido = readFileSync(rutaAccesos, "utf8");
} catch {
  console.error(
    `No se encontro ${rutaAccesos}. Ahi vive el token de desarrollo.`,
  );
  process.exit(1);
}

// Toma el valor de la linea "- Token CLI:" sin arrastrar el resto del archivo.
const encontrado = contenido.match(/^-\s*Token CLI:\s*(\S+)\s*$/m);

if (!encontrado?.[1] || !encontrado[1].startsWith("cf")) {
  console.error(
    'No hay un token utilizable en la linea "- Token CLI:" de .claude/ACCESO.local.md.',
  );
  process.exit(1);
}

const argumentos = process.argv.slice(2);
if (argumentos.length === 0) {
  console.error("Uso: node scripts/cf.mjs <argumentos de wrangler>");
  process.exit(1);
}

// Se llama el entrypoint de wrangler con el mismo node que corre este script.
// Pasar por la shell obligaria a `shell: true`, que no escapa los argumentos y
// Node marca como deprecado por eso mismo.
const wrangler = join(raiz, "node_modules", "wrangler", "bin", "wrangler.js");

const proceso = spawn(process.execPath, [wrangler, ...argumentos], {
  stdio: "inherit",
  cwd: raiz,
  env: { ...process.env, CLOUDFLARE_API_TOKEN: encontrado[1] },
});

proceso.on("exit", (codigo) => process.exit(codigo ?? 1));
