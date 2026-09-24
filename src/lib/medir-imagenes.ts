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
    const señal = AbortSignal.timeout(tiempoMs);
    const respuesta = await pedir(url, {
      headers: { Accept: ACEPTA, Range: `bytes=0-${TOPE_BYTES - 1}` },
      signal: señal,
    });
    if (!respuesta.ok || !respuesta.body) {
      // Una respuesta de error tambien trae cuerpo; sin cancelarlo, la conexion
      // queda abierta hasta que el servidor termine de mandarlo.
      await respuesta.body?.cancel().catch(() => {});
      return null;
    }

    const lector = respuesta.body.getReader();
    const trozos: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < TOPE_BYTES) {
        // La señal corta `fetch`, pero no siempre una lectura ya en curso: un
        // servidor que manda las cabeceras y luego gotea bytes alargaria la
        // subida sin limite. Cada lectura compite contra el tope de tiempo.
        const { done, value } = await Promise.race([
          lector.read(),
          agotado(señal),
        ]);
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

// Una promesa que falla cuando la señal se agota, para ponerla a competir.
function agotado(señal: AbortSignal): Promise<never> {
  return new Promise((_, rechazar) => {
    if (señal.aborted) return rechazar(señal.reason);
    señal.addEventListener("abort", () => rechazar(señal.reason), {
      once: true,
    });
  });
}

// Lo que el autor escribio a mano en un `<img>` de HTML crudo. El 0 cuenta: es
// una decision suya, aunque rara.
const puesto = (valor: unknown) =>
  valor !== undefined && valor !== null && valor !== "";

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
    (img) => !(puesto(img.properties?.width) && puesto(img.properties?.height)),
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
        ...completar(img.properties, medida),
      };
    }
  });

  // En el orden del articulo, que es como las va a buscar quien lo escribio.
  return urls.filter((src) => sinMedir.has(src));
}

// Si el autor dio una sola medida, es la que eligio para mostrarla: se conserva
// y la otra sale de la proporcion real. Pisarla con la medida natural cambiaria
// el tamaño que quiso.
function completar(
  propiedades: Record<string, unknown> | undefined,
  { ancho, alto }: { ancho: number; alto: number },
): { width: number; height: number } {
  const suAncho = Number(propiedades?.width);
  const suAlto = Number(propiedades?.height);
  if (puesto(propiedades?.width) && suAncho > 0) {
    return { width: suAncho, height: Math.round((suAncho * alto) / ancho) };
  }
  if (puesto(propiedades?.height) && suAlto > 0) {
    return { width: Math.round((suAlto * ancho) / alto), height: suAlto };
  }
  return { width: ancho, height: alto };
}

const MAXIMO_NOMBRADAS = 5;
// Una URL firmada de CDN puede medir kilobytes. El aviso viaja en la URL de la
// redireccion, y cinco de esas pasarian el limite: el articulo se guardaria,
// pero quien lo sube veria un error.
const MAXIMO_CARACTERES_URL = 100;

const recortar = (url: string) =>
  url.length > MAXIMO_CARACTERES_URL
    ? `${url.slice(0, MAXIMO_CARACTERES_URL)}…`
    : url;

/**
 * El trozo del aviso de la subida que dice que imagenes se quedaron sin medir.
 * Sin el motivo tecnico: el arreglo es el mismo en todos los casos (revisar que
 * la URL abra, o poner `width` y `height` a mano). Vacio si no falto ninguna.
 */
export function describirSinMedir(urls: string[]): string {
  if (urls.length === 0) return "";
  const nombradas = urls.slice(0, MAXIMO_NOMBRADAS).map(recortar).join(", ");
  const resto = urls.length - MAXIMO_NOMBRADAS;
  const lista = resto > 0 ? `${nombradas} y ${resto} más` : nombradas;
  return urls.length === 1
    ? `No se pudo medir 1 imagen (el texto puede saltar al cargarla): ${lista}.`
    : `No se pudieron medir ${urls.length} imágenes (el texto puede saltar al cargarlas): ${lista}.`;
}
