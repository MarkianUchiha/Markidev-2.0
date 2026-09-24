import { medidasDeImagen } from "./medidas-imagen";

// Pide las imagenes de un articulo y les escribe `width` y `height` al subirlo
// (`specs/medidas-de-imagenes.md`). Separado del lector de cabeceras porque esto
// si toca la red; `pedir` se inyecta para poder probar servidores lentos, rotos
// o que ignoran `Range` sin salir a internet.

const TOPE_BYTES = 128 * 1024;
const TIEMPO_MS = 3000;
const MAXIMO_IMAGENES = 20;
// Sin AVIF: un CDN que negocia formato lo mandaria, y su cabecera es la mas
// dificil de leer. Las medidas son las mismas en cualquier formato.
const ACEPTA = "image/jpeg, image/png, image/gif, image/webp";

type Pedir = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Lo minimo de un nodo de hast que hace falta para encontrar las `<img>`. */
export interface NodoHtml {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: NodoHtml[];
}

/**
 * Los primeros bytes de una imagen, o null si no se pudo. Pide solo el
 * principio con `Range`, y aunque el servidor lo ignore y mande el archivo
 * entero, deja de leer al llegar al tope y corta la descarga.
 */
export async function leerInicio(
  url: string,
  {
    pedir = fetch,
    tiempoMs = TIEMPO_MS,
  }: { pedir?: Pedir; tiempoMs?: number } = {},
): Promise<Uint8Array | null> {
  try {
    // La misma señal corta la espera de la respuesta y la lectura del cuerpo.
    const respuesta = await pedir(url, {
      headers: { Accept: ACEPTA, Range: `bytes=0-${TOPE_BYTES - 1}` },
      signal: AbortSignal.timeout(tiempoMs),
    });
    if (!respuesta.ok || !respuesta.body) return null;

    const lector = respuesta.body.getReader();
    const trozos: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < TOPE_BYTES) {
        const { done, value } = await lector.read();
        if (done) break;
        trozos.push(value);
        total += value.length;
      }
    } finally {
      // Sin esto, un servidor que ignora `Range` seguiria mandando la imagen
      // entera aunque ya no la leamos.
      await lector.cancel().catch(() => {});
    }

    const datos = new Uint8Array(Math.min(total, TOPE_BYTES));
    let desde = 0;
    for (const trozo of trozos) {
      const cabe = Math.min(trozo.length, datos.length - desde);
      datos.set(trozo.subarray(0, cabe), desde);
      desde += cabe;
      if (desde >= datos.length) break;
    }
    return datos;
  } catch {
    // Tiempo agotado, red caida, DNS: para quien sube el articulo es lo mismo,
    // la imagen se queda sin medir.
    return null;
  }
}

function imagenesDe(nodo: NodoHtml, encontradas: NodoHtml[] = []): NodoHtml[] {
  if (nodo.type === "element" && nodo.tagName === "img") encontradas.push(nodo);
  for (const hijo of nodo.children ?? []) imagenesDe(hijo, encontradas);
  return encontradas;
}

/**
 * Mide las `<img>` del arbol y les escribe `width` y `height`. Devuelve las URL
 * que no pudo medir, sin repetir, en el orden en que aparecen. Nunca lanza: una
 * imagen que falla no puede impedir que se guarde el articulo.
 */
export async function medirImagenes(
  arbol: NodoHtml,
  { origen, pedir = fetch }: { origen: string; pedir?: Pedir },
): Promise<string[]> {
  // Las que el autor ya midio a mano se respetan y no se piden.
  const pendientes = imagenesDe(arbol).filter(
    (img) => !(img.properties?.width && img.properties?.height),
  );

  // Una peticion por URL distinta, aunque la imagen salga varias veces.
  const porUrl = new Map<string, NodoHtml[]>();
  for (const img of pendientes) {
    const src = String(img.properties?.src ?? "");
    if (!src) continue;
    porUrl.set(src, [...(porUrl.get(src) ?? []), img]);
  }

  const urls = [...porUrl.keys()];
  const medibles = urls.slice(0, MAXIMO_IMAGENES);
  const sinMedir = new Set(urls.slice(MAXIMO_IMAGENES));

  // En paralelo: la subida tarda lo que la imagen mas lenta, no la suma.
  const medidas = await Promise.all(
    medibles.map(async (src) => {
      let url: URL;
      try {
        url = new URL(src, origen);
      } catch {
        return null;
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      const datos = await leerInicio(url.href, { pedir });
      return datos ? medidasDeImagen(datos) : null;
    }),
  );

  medibles.forEach((src, i) => {
    const medida = medidas[i];
    if (!medida) {
      sinMedir.add(src);
      return;
    }
    for (const img of porUrl.get(src) ?? []) {
      img.properties = {
        ...img.properties,
        width: medida.ancho,
        height: medida.alto,
      };
    }
  });

  // En el orden del articulo, que es como las va a buscar quien lo escribio.
  return urls.filter((src) => sinMedir.has(src));
}

const MAXIMO_NOMBRADAS = 5;

/**
 * El trozo del aviso de la subida que dice que imagenes se quedaron sin medir.
 * Sin el motivo tecnico: el arreglo es el mismo en todos los casos (revisar que
 * la URL abra, o poner `width` y `height` a mano). Vacio si no falto ninguna.
 */
export function describirSinMedir(urls: string[]): string {
  if (urls.length === 0) return "";
  const nombradas = urls.slice(0, MAXIMO_NOMBRADAS).join(", ");
  const resto = urls.length - MAXIMO_NOMBRADAS;
  const lista = resto > 0 ? `${nombradas} y ${resto} más` : nombradas;
  return urls.length === 1
    ? `No se pudo medir 1 imagen (el texto puede saltar al cargarla): ${lista}.`
    : `No se pudieron medir ${urls.length} imágenes (el texto puede saltar al cargarlas): ${lista}.`;
}
