import { env } from "cloudflare:workers";
import type { CanalId, EtapaId } from "./pipeline";
import { esquemaBlog, type DatosBlog } from "./frontmatter";

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

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

// Lo que devuelve SQLite. `datos` es el frontmatter en JSON y `publicado` un
// entero, porque D1 no tiene ni objetos ni booleanos.
interface PostFila {
  id: string;
  coleccion: Coleccion;
  datos: string;
  cuerpo: string;
  html: string;
  publicado: number;
  fecha: string;
  creado_en: string;
  actualizado_en: string;
}

export type Coleccion = "blog";

export interface Post {
  id: string;
  datos: DatosBlog;
  cuerpo: string;
  html: string;
  publicado: boolean;
  creado_en: string;
  actualizado_en: string;
}

// El frontmatter se valido al guardarlo, asi que aqui solo puede fallar si el
// esquema cambio despues. En ese caso el post se descarta del listado en vez de
// tumbar la pagina entera: un articulo desaparecido se nota y se arregla; un
// blog que responde 500 se lleva por delante tambien a los que estan bien.
function aPost(fila: PostFila): Post | null {
  const resultado = esquemaBlog.safeParse(JSON.parse(fila.datos));
  if (!resultado.success) {
    console.error(
      `El post ${fila.id} no cumple el esquema actual y se omitio:`,
      resultado.error.issues,
    );
    return null;
  }
  return {
    id: fila.id,
    datos: resultado.data,
    cuerpo: fila.cuerpo,
    html: fila.html,
    publicado: fila.publicado === 1,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  };
}

/**
 * Los posts de una coleccion, del mas reciente al mas viejo. `soloPublicados`
 * es lo que pide el sitio publico; el panel los quiere todos.
 */
export async function listarPosts(
  coleccion: Coleccion,
  { soloPublicados = true } = {},
): Promise<Post[]> {
  const { results } = await db()
    .prepare(
      `SELECT * FROM posts
        WHERE coleccion = ?${soloPublicados ? " AND publicado = 1" : ""}
        ORDER BY fecha DESC`,
    )
    .bind(coleccion)
    .all<PostFila>();
  return results.map(aPost).filter((post): post is Post => post !== null);
}

export async function obtenerPost(
  id: string,
  { soloPublicado = true } = {},
): Promise<Post | null> {
  const fila = await db()
    .prepare(
      `SELECT * FROM posts WHERE id = ?${soloPublicado ? " AND publicado = 1" : ""}`,
    )
    .bind(id)
    .first<PostFila>();
  return fila ? aPost(fila) : null;
}

export interface PostAGuardar {
  id: string;
  coleccion: Coleccion;
  datos: DatosBlog;
  cuerpo: string;
  html: string;
}

/**
 * Alta o reemplazo. Si el post ya existia, su version anterior se copia a
 * `post_revisiones` en la misma transaccion: es el historial que en un flujo de
 * archivos daba git, y guardarlo aparte permitiria perderlo si algo falla en
 * medio.
 *
 * El estado de publicado NO se toca al reeditar. Subir una correccion no deberia
 * publicar un borrador sin querer.
 */
export async function guardarPost(
  post: PostAGuardar,
  autor: string,
): Promise<{ creado: boolean }> {
  const previo = await db()
    .prepare("SELECT * FROM posts WHERE id = ?")
    .bind(post.id)
    .first<PostFila>();

  const ahora = new Date().toISOString();
  const datos = JSON.stringify(post.datos);
  // El frontmatter manda la fecha de orden. Se saca a su propia columna porque
  // ordenar por un campo dentro del JSON obligaria a leer todas las filas.
  const fecha = post.datos.pubDate.toISOString();

  if (!previo) {
    // El borrador del frontmatter decide el estado inicial: un .md con
    // `draft: true` entra sin publicar.
    await db()
      .prepare(
        `INSERT INTO posts (id, coleccion, datos, cuerpo, html, publicado, fecha, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        post.id,
        post.coleccion,
        datos,
        post.cuerpo,
        post.html,
        post.datos.draft ? 0 : 1,
        fecha,
        ahora,
        ahora,
      )
      .run();
    return { creado: true };
  }

  await db().batch([
    db()
      .prepare(
        `INSERT INTO post_revisiones (id, post_id, datos, cuerpo, autor, creado_en)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        post.id,
        previo.datos,
        previo.cuerpo,
        autor,
        ahora,
      ),
    db()
      .prepare(
        `UPDATE posts SET datos = ?, cuerpo = ?, html = ?, fecha = ?, actualizado_en = ?
          WHERE id = ?`,
      )
      .bind(datos, post.cuerpo, post.html, fecha, ahora, post.id),
  ]);

  return { creado: false };
}

/** Devuelve el estado nuevo, o null si el post no existe. */
export async function alternarPublicado(id: string): Promise<boolean | null> {
  const fila = await db()
    .prepare(
      `UPDATE posts SET publicado = 1 - publicado, actualizado_en = ?
        WHERE id = ? RETURNING publicado`,
    )
    .bind(new Date().toISOString(), id)
    .first<{ publicado: number }>();
  return fila ? fila.publicado === 1 : null;
}

export async function borrarPost(id: string): Promise<boolean> {
  // Las revisiones caen solas por la clave foranea con ON DELETE CASCADE.
  const { meta } = await db()
    .prepare("DELETE FROM posts WHERE id = ?")
    .bind(id)
    .run();
  return meta.changes > 0;
}
