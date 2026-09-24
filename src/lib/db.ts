import { env } from "cloudflare:workers";
import type { CanalId, EtapaId } from "./pipeline";
import { esquemaBlog, type DatosBlog } from "./frontmatter";
import { describirCambios, type Edicion } from "./articulo";
import { intercambioDeOrden, type Enlace, type EnlaceNuevo } from "./enlaces";

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
): Promise<
  | { creado: true }
  // `anterior` es lo que habia, para que el aviso diga que cambio: subir una
  // copia vieja del .md revierte las correcciones del panel sin hacer ruido.
  | { creado: false; anterior: { title: string; description: string } }
> {
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

  const { title, description } = JSON.parse(previo.datos) as DatosBlog;
  return { creado: false, anterior: { title, description } };
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

export type ResultadoEdicion =
  { ok: true; cambios: string } | { ok: false; error: string };

/**
 * Cambia titulo, descripcion y URL desde el panel, en una sola transaccion: si
 * fueran dos, un fallo a medias dejaria el titulo cambiado y la URL no. La
 * version anterior queda en `post_revisiones`, igual que al subir un archivo.
 *
 * `cambios` es el texto del aviso; vacio si no cambio nada, y entonces no se
 * escribe nada ni se crea una revision que no aporta.
 */
export async function editarPost(
  id: string,
  edicion: Edicion,
  autor: string,
): Promise<ResultadoEdicion> {
  const previo = await db()
    .prepare("SELECT * FROM posts WHERE id = ?")
    .bind(id)
    .first<PostFila>();
  if (!previo) return { ok: false, error: "Ese artículo ya no existe." };

  // Se edita el JSON tal cual en vez de pasarlo por el esquema: asi el resto del
  // frontmatter (fechas incluidas) sale byte a byte como estaba.
  const datosPrevios = JSON.parse(previo.datos) as Record<string, unknown>;
  const cambios = describirCambios(
    {
      title: String(datosPrevios.title),
      description: String(datosPrevios.description),
      slug: id,
    },
    edicion,
  );
  if (!cambios) return { ok: true, cambios };

  const nuevo = edicion.slug;
  const renombra = nuevo !== id;
  if (renombra) {
    const ocupada = await urlOcupada(nuevo, id);
    if (ocupada) return { ok: false, error: ocupada };
  }

  const ahora = new Date().toISOString();
  const datos = JSON.stringify({
    ...datosPrevios,
    title: edicion.title,
    description: edicion.description,
  });

  const revision = db()
    .prepare(
      `INSERT INTO post_revisiones (id, post_id, datos, cuerpo, autor, creado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      nuevo,
      previo.datos,
      previo.cuerpo,
      autor,
      ahora,
    );

  if (!renombra) {
    await db().batch([
      revision,
      db()
        .prepare("UPDATE posts SET datos = ?, actualizado_en = ? WHERE id = ?")
        .bind(datos, ahora, id),
    ]);
    return { ok: true, cambios };
  }

  // El id es la clave primaria y `post_revisiones` la referencia sin
  // ON UPDATE CASCADE, asi que un UPDATE del id falla. Se crea la fila nueva, se
  // mudan a ella las revisiones y las redirecciones, y solo entonces se borra la
  // vieja: al reves, el ON DELETE CASCADE se las llevaria. `batch` es una
  // transaccion, asi que o pasa todo o nada.
  const renombrado = db().batch([
    db()
      .prepare(
        `INSERT INTO posts (id, coleccion, datos, cuerpo, html, publicado, fecha, creado_en, actualizado_en)
         SELECT ?, coleccion, ?, cuerpo, html, publicado, fecha, creado_en, ?
           FROM posts WHERE id = ?`,
      )
      .bind(nuevo, datos, ahora, id),
    db()
      .prepare("UPDATE post_revisiones SET post_id = ? WHERE post_id = ?")
      .bind(nuevo, id),
    // Reapuntar todo lo que llevaba a la URL vieja es lo que evita cadenas:
    // A→B seguido de B→C deja A→C, no A→B→C.
    db()
      .prepare("UPDATE post_redirecciones SET hacia = ? WHERE hacia = ?")
      .bind(nuevo, id),
    // Volver a una URL anterior: deja de ser origen de redireccion, porque una
    // URL no puede ser articulo y redireccion a la vez.
    db().prepare("DELETE FROM post_redirecciones WHERE desde = ?").bind(nuevo),
    db().prepare("DELETE FROM posts WHERE id = ?").bind(id),
    db()
      .prepare(
        "INSERT INTO post_redirecciones (desde, hacia, creado_en) VALUES (?, ?, ?)",
      )
      .bind(id, nuevo, ahora),
    revision,
  ]);
  try {
    await renombrado;
  } catch (error) {
    // Si el articulo se borro entre la lectura y el batch, el INSERT...SELECT no
    // copia nada y la llave foranea de la redireccion revierte todo. No hay datos
    // perdidos, pero merece el mismo mensaje que cualquier articulo que ya no
    // existe, no un 500. Cualquier otro fallo sigue siendo un error de verdad.
    const sigue = await db()
      .prepare("SELECT 1 FROM posts WHERE id = ?")
      .bind(id)
      .first();
    if (!sigue) return { ok: false, error: "Ese artículo ya no existe." };
    throw error;
  }
  return { ok: true, cambios };
}

/**
 * Por que no se puede usar `slug` como URL nueva del articulo `propio`, o null
 * si esta libre. Una redireccion que ya lleva a `propio` no cuenta: es volver a
 * una URL anterior del mismo articulo.
 */
async function urlOcupada(
  slug: string,
  propio: string,
): Promise<string | null> {
  const post = await db()
    .prepare("SELECT id FROM posts WHERE id = ?")
    .bind(slug)
    .first<{ id: string }>();
  if (post) return `La URL /blog/${slug}/ ya es de otro artículo.`;

  const hacia = await buscarRedireccion(slug);
  if (hacia && hacia !== propio) {
    return `La URL /blog/${slug}/ ya redirige a /blog/${hacia}/.`;
  }
  return null;
}

/** El slug vivo al que lleva una URL vieja, o null si no es una URL vieja. */
export async function buscarRedireccion(slug: string): Promise<string | null> {
  const fila = await db()
    .prepare("SELECT hacia FROM post_redirecciones WHERE desde = ?")
    .bind(slug)
    .first<{ hacia: string }>();
  return fila?.hacia ?? null;
}

// ---------------------------------------------------------------------------
// Enlaces de la pagina de redes. Las reglas (que URL pasa, cuando vence, como se
// reordena) viven en `enlaces.ts`; aqui solo se lee y se escribe.

interface EnlaceFila {
  id: string;
  titulo: string;
  url: string;
  descripcion: string | null;
  visible: number;
  vence_en: string | null;
  orden: number;
  creado_en: string;
  actualizado_en: string;
}

function aEnlace(fila: EnlaceFila): Enlace {
  return {
    id: fila.id,
    titulo: fila.titulo,
    url: fila.url,
    descripcion: fila.descripcion,
    visible: fila.visible === 1,
    vence_en: fila.vence_en,
    orden: fila.orden,
  };
}

/**
 * Todos, en su orden. El sitio publico filtra con `enlacesVisibles`, que tambien
 * descarta los vencidos: son pocas filas y asi la regla del vencimiento vive en
 * un solo lugar, con sus tests, en vez de repetirse en SQL.
 */
export async function listarEnlaces(): Promise<Enlace[]> {
  const { results } = await db()
    .prepare("SELECT * FROM enlaces ORDER BY orden")
    .all<EnlaceFila>();
  return results.map(aEnlace);
}

export async function obtenerEnlace(id: string): Promise<Enlace | null> {
  const fila = await db()
    .prepare("SELECT * FROM enlaces WHERE id = ?")
    .bind(id)
    .first<EnlaceFila>();
  return fila ? aEnlace(fila) : null;
}

/** Entra visible y al final de la lista: lo nuevo no desplaza lo que ya estaba. */
export async function crearEnlace(enlace: EnlaceNuevo): Promise<string> {
  const id = crypto.randomUUID();
  const ahora = new Date().toISOString();
  // El MAX va dentro del INSERT para que dos altas simultaneas no lean el mismo
  // orden entre la consulta y la escritura.
  await db()
    .prepare(
      `INSERT INTO enlaces (id, titulo, url, descripcion, visible, vence_en, orden, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, 1, ?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM enlaces), ?, ?)`,
    )
    .bind(
      id,
      enlace.titulo,
      enlace.url,
      enlace.descripcion,
      enlace.vence_en,
      ahora,
      ahora,
    )
    .run();
  return id;
}

/** Edita el contenido sin tocar si se ve ni su lugar en la lista. */
export async function actualizarEnlace(
  id: string,
  enlace: EnlaceNuevo,
): Promise<boolean> {
  const { meta } = await db()
    .prepare(
      `UPDATE enlaces SET titulo = ?, url = ?, descripcion = ?, vence_en = ?, actualizado_en = ?
        WHERE id = ?`,
    )
    .bind(
      enlace.titulo,
      enlace.url,
      enlace.descripcion,
      enlace.vence_en,
      new Date().toISOString(),
      id,
    )
    .run();
  return meta.changes > 0;
}

/** Devuelve el estado nuevo, o null si el enlace no existe. */
export async function alternarVisible(id: string): Promise<boolean | null> {
  const fila = await db()
    .prepare(
      `UPDATE enlaces SET visible = 1 - visible, actualizado_en = ?
        WHERE id = ? RETURNING visible`,
    )
    .bind(new Date().toISOString(), id)
    .first<{ visible: number }>();
  return fila ? fila.visible === 1 : null;
}

/**
 * Las dos filas del intercambio se escriben en un `batch`, que D1 corre como una
 * transaccion: si una fallara, la lista no se queda con dos enlaces en el mismo
 * lugar. Devuelve false cuando no hay vecino con quien cambiar.
 */
export async function moverEnlace(
  id: string,
  direccion: "subir" | "bajar",
): Promise<boolean> {
  const cambios = intercambioDeOrden(await listarEnlaces(), id, direccion);
  if (!cambios) return false;
  const ahora = new Date().toISOString();
  await db().batch(
    cambios.map(({ id: fila, orden }) =>
      db()
        .prepare(
          "UPDATE enlaces SET orden = ?, actualizado_en = ? WHERE id = ?",
        )
        .bind(orden, ahora, fila),
    ),
  );
  return true;
}

export async function borrarEnlace(id: string): Promise<boolean> {
  const { meta } = await db()
    .prepare("DELETE FROM enlaces WHERE id = ?")
    .bind(id)
    .run();
  return meta.changes > 0;
}
