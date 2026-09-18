#!/usr/bin/env node
// Sube a Cloudflare los secretos del Worker que viven en `.claude/ACCESO.local.md`.
//
//   node scripts/cf-secretos.mjs
//
// `wrangler secret put` pide el valor de forma interactiva o lo lee de stdin.
// Aqui se le entrega por stdin: asi el valor nunca aparece en la linea de
// comandos ni en la salida, solo el nombre del secreto.
//
// Las lineas vacias se saltan. Volver a correrlo reemplaza los valores.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const rutaAccesos = join(raiz, ".claude", "ACCESO.local.md");

// Etiqueta en ACCESO.local.md -> nombre del secreto en el Worker.
const SECRETOS = {
  "Turnstile secret key": "TURNSTILE_SECRET_KEY",
  "Resend API key": "RESEND_API_KEY",
  "Resend destinatario": "RESEND_TO",
};

let contenido;
try {
  contenido = readFileSync(rutaAccesos, "utf8");
} catch {
  console.error(`No se encontro ${rutaAccesos}.`);
  process.exit(1);
}

function leer(etiqueta) {
  const escapada = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const encontrado = contenido.match(
    new RegExp(`^-\\s*${escapada}:[ \\t]*(\\S+)[ \\t]*$`, "m"),
  );
  return encontrado?.[1];
}

const token = leer("Token CLI");
if (!token?.startsWith("cf")) {
  console.error('No hay un token utilizable en "- Token CLI:".');
  process.exit(1);
}

const wrangler = join(raiz, "node_modules", "wrangler", "bin", "wrangler.js");

function subir(nombre, valor) {
  return new Promise((resolver) => {
    const proceso = spawn(
      process.execPath,
      [wrangler, "secret", "put", nombre],
      {
        // La salida de wrangler se descarta: no imprime el valor, pero asi no
        // depende de que eso siga siendo cierto en versiones futuras.
        stdio: ["pipe", "ignore", "pipe"],
        cwd: raiz,
        env: { ...process.env, CLOUDFLARE_API_TOKEN: token },
      },
    );
    let errores = "";
    proceso.stderr.on("data", (trozo) => (errores += trozo));
    proceso.stdin.end(valor);
    proceso.on("exit", (codigo) => resolver({ ok: codigo === 0, errores }));
  });
}

let pendientes = 0;
let fallidos = 0;
for (const [etiqueta, nombre] of Object.entries(SECRETOS)) {
  const valor = leer(etiqueta);
  if (!valor) {
    console.log(`-  ${nombre}: vacio en ACCESO.local.md, se salta`);
    pendientes++;
    continue;
  }
  const { ok, errores } = await subir(nombre, valor);
  // El stderr de wrangler se muestra sin el valor por si lo repitiera.
  const limpio = errores.split(valor).join("<oculto>").trim();
  console.log(ok ? `✓  ${nombre}` : `✗  ${nombre}\n${limpio}`);
  if (!ok) fallidos++;
}

console.log(
  `\n${Object.keys(SECRETOS).length - pendientes - fallidos} subidos, ${pendientes} vacios, ${fallidos} con error.`,
);
process.exit(fallidos > 0 ? 1 : 0);
