import { env } from "cloudflare:workers";
import type { CanalId, EtapaId } from "./pipeline";

// El binding se lee dentro de cada funcion, nunca al cargar el modulo: fuera de
// una peticion `env` no existe todavia y tocarlo arriba rompe el build.
//
// Ojo con la version: `Astro.locals.runtime` desaparecio en el adaptador v13.
// Con @astrojs/cloudflare 14 la unica via es este import.
function db(): D1Database {
  const binding = env.DB;
  if (!binding) {
    throw new Error(
      "Falta el binding DB. Revisa d1_databases en wrangler.jsonc y que la base exista.",
    );
  }
  return binding;
}

export interface Lead {
  id: string;
  nombre: string;
  contacto: string | null;
  canal: CanalId;
  mensaje: string | null;
  etapa: EtapaId;
  orden: number;
  valor_estimado: number | null;
  esquema_pago: string | null;
  motivo: string | null;
  retomar_el: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface NuevoLead {
  nombre: string;
  contacto?: string | null;
  canal: CanalId;
  mensaje?: string | null;
  valor_estimado?: number | null;
}

export async function listarLeads(): Promise<Lead[]> {
  const { results } = await db()
    .prepare("SELECT * FROM leads ORDER BY etapa, orden")
    .all<Lead>();
  return results;
}

export async function obtenerLead(id: string): Promise<Lead | null> {
  return await db()
    .prepare("SELECT * FROM leads WHERE id = ?")
    .bind(id)
    .first<Lead>();
}

/**
 * Crea el lead y su evento de alta en una sola transaccion. Si el evento fallara
 * por separado quedaria un lead sin origen registrado, que es justo lo que el
 * historial existe para evitar.
 */
export async function crearLead(
  datos: NuevoLead,
  autor: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const ahora = new Date().toISOString();

  // Se coloca al final de la columna. Con pocas tarjetas por columna el orden
  // exacto importa poco, y arrastrar lo corrige.
  const siguiente = await db()
    .prepare(
      "SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM leads WHERE etapa = 'nuevo'",
    )
    .first<{ siguiente: number }>();

  await db().batch([
    db()
      .prepare(
        `INSERT INTO leads (id, nombre, contacto, canal, mensaje, etapa, orden, valor_estimado, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, 'nuevo', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        datos.nombre,
        datos.contacto ?? null,
        datos.canal,
        datos.mensaje ?? null,
        siguiente?.siguiente ?? 0,
        datos.valor_estimado ?? null,
        ahora,
        ahora,
      ),
    db()
      .prepare(
        `INSERT INTO lead_eventos (id, lead_id, tipo, a_etapa, autor, creado_en)
         VALUES (?, ?, 'creado', 'nuevo', ?, ?)`,
      )
      .bind(crypto.randomUUID(), id, autor, ahora),
  ]);

  return id;
}

export interface CambioDeEtapa {
  etapa: EtapaId;
  // La base exige motivo para descartar y fecha para retomar. Se mandan aqui
  // para que el movimiento y su justificacion viajen juntos.
  motivo?: string | null;
  retomar_el?: string | null;
}

/**
 * Mueve un lead de columna y deja constancia de quien lo movio.
 * Devuelve false si el lead no existe.
 */
export async function moverLead(
  id: string,
  cambio: CambioDeEtapa,
  autor: string,
): Promise<boolean> {
  const actual = await obtenerLead(id);
  if (!actual) return false;

  const ahora = new Date().toISOString();

  // Cae al final de su nueva columna. Con cinco tarjetas por columna el orden
  // exacto no cambia nada, y calcularlo aqui evita que el endpoint tenga que
  // saber como se ordena el tablero.
  const siguiente = await db()
    .prepare(
      "SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM leads WHERE etapa = ?",
    )
    .bind(cambio.etapa)
    .first<{ siguiente: number }>();

  const sentencias = [
    db()
      .prepare(
        `UPDATE leads
            SET etapa = ?, orden = ?, motivo = ?, retomar_el = ?, actualizado_en = ?
          WHERE id = ?`,
      )
      .bind(
        cambio.etapa,
        siguiente?.siguiente ?? 0,
        cambio.motivo ?? null,
        cambio.retomar_el ?? null,
        ahora,
        id,
      ),
  ];

  // Reordenar dentro de la misma columna no es un cambio de etapa y llenaria el
  // historial de ruido. Solo se registra el salto real entre columnas.
  if (actual.etapa !== cambio.etapa) {
    sentencias.push(
      db()
        .prepare(
          `INSERT INTO lead_eventos (id, lead_id, tipo, de_etapa, a_etapa, nota, autor, creado_en)
           VALUES (?, ?, 'movido', ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          actual.etapa,
          cambio.etapa,
          cambio.motivo ?? null,
          autor,
          ahora,
        ),
    );
  }

  await db().batch(sentencias);
  return true;
}
