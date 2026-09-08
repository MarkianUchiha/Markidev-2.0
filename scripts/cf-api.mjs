#!/usr/bin/env node
// Consulta la API de Cloudflare con el token de desarrollo, sin exponerlo en la
// linea de comandos. Mismo motivo que `cf.mjs`: un token interpolado en un curl
// queda en el historial de la shell y en cualquier transcript.
//
//   node scripts/cf-api.mjs /user/tokens/verify
//   node scripts/cf-api.mjs /accounts/:cuenta/access/organizations
//
// `:cuenta` se sustituye por el Account ID que vive en ACCESO.local.md.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const accesos = readFileSync(join(raiz, ".claude", "ACCESO.local.md"), "utf8");

const token = accesos.match(/^-\s*Token CLI:\s*(\S+)\s*$/m)?.[1];
const cuenta = accesos.match(/^-\s*Site ID \/ Project ID:\s*(\S+)/m)?.[1];

if (!token) {
  console.error('Falta la linea "- Token CLI:" en .claude/ACCESO.local.md.');
  process.exit(1);
}

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: node scripts/cf-api.mjs /ruta/de/la/api");
  process.exit(1);
}

const respuesta = await fetch(
  `https://api.cloudflare.com/client/v4${ruta.replace(":cuenta", cuenta ?? "")}`,
  { headers: { Authorization: `Bearer ${token}` } },
);

const datos = await respuesta.json();

// Solo se imprime el resultado de la API. El token nunca sale por stdout.
console.log(JSON.stringify(datos, null, 2));
process.exit(respuesta.ok && datos.success !== false ? 0 : 1);
