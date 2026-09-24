import { describe, expect, it, vi } from "vitest";
import {
  describirSinMedir,
  leerInicio,
  medirImagenes,
  type NodoHtml,
} from "./medir-imagenes";

// PNG minimo de 1200 × 630: firma, IHDR y las medidas.
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44,
  0x52, 0, 0, 0x04, 0xb0, 0, 0, 0x02, 0x76, 8, 6, 0, 0, 0,
]);

// Una respuesta cuyo cuerpo llega en trozos, contando cuanto se llego a leer y
// si se cancelo: es lo que prueba que un servidor que ignora `Range` no nos
// hace descargar la imagen entera.
function respuestaEnTrozos(total: number, trozo = 16 * 1024) {
  const estado = { leido: 0, cancelado: false };
  const cuerpo = new ReadableStream<Uint8Array>({
    pull(control) {
      if (estado.leido >= total) return control.close();
      const datos = new Uint8Array(Math.min(trozo, total - estado.leido));
      if (estado.leido === 0) datos.set(PNG);
      estado.leido += datos.length;
      control.enqueue(datos);
    },
    cancel() {
      estado.cancelado = true;
    },
  });
  return { respuesta: new Response(cuerpo, { status: 200 }), estado };
}

describe("leerInicio", () => {
  it("pide solo el principio y sin AVIF", async () => {
    const pedir = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(PNG, { status: 206 }),
    );
    await leerInicio("https://img.test/a.png", { pedir });

    const cabeceras = new Headers(pedir.mock.calls[0][1]?.headers);
    expect(cabeceras.get("Range")).toBe("bytes=0-131071");
    expect(cabeceras.get("Accept")).toBe(
      "image/jpeg, image/png, image/gif, image/webp",
    );
  });

  it("si el servidor ignora Range, no lee mas de 128 KB y corta la descarga", async () => {
    const { respuesta, estado } = respuestaEnTrozos(5 * 1024 * 1024);
    const datos = await leerInicio("https://img.test/a.png", {
      pedir: async () => respuesta,
    });

    expect(datos?.length).toBe(128 * 1024);
    // Un trozo de margen: el stream pide uno por adelantado para su cola.
    // Lo que importa es que no baja los 5 MB.
    expect(estado.leido).toBeLessThanOrEqual(128 * 1024 + 16 * 1024);
    expect(estado.cancelado).toBe(true);
  });

  it("devuelve null con un 404", async () => {
    const pedir = async () => new Response("no", { status: 404 });
    expect(await leerInicio("https://img.test/a.png", { pedir })).toBeNull();
  });

  it("devuelve null si tarda mas del tope", async () => {
    // Un servidor que solo responde cuando lo abortan.
    const pedir = (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, rechazar) =>
        init?.signal?.addEventListener("abort", () =>
          rechazar(new Error("abortado")),
        ),
      );
    expect(
      await leerInicio("https://img.test/a.png", { pedir, tiempoMs: 30 }),
    ).toBeNull();
  });

  it("devuelve null si la red falla", async () => {
    const pedir = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await leerInicio("https://img.test/a.png", { pedir })).toBeNull();
  });
});

const img = (src: string, extra: Record<string, unknown> = {}): NodoHtml => ({
  type: "element",
  tagName: "img",
  properties: { src, alt: "", ...extra },
  children: [],
});

const arbol = (...hijos: NodoHtml[]): NodoHtml => ({
  type: "root",
  children: [
    { type: "element", tagName: "p", properties: {}, children: hijos },
  ],
});

describe("medirImagenes", () => {
  const origen = "https://markidev.com";

  it("escribe width y height en las imagenes que puede medir", async () => {
    const imagen = img("https://img.test/a.png");
    const sinMedir = await medirImagenes(arbol(imagen), {
      origen,
      pedir: async () => new Response(PNG),
    });

    expect(imagen.properties).toMatchObject({ width: 1200, height: 630 });
    expect(sinMedir).toEqual([]);
  });

  it("respeta las medidas que ya puso el autor y no pide esa imagen", async () => {
    const imagen = img("https://img.test/a.png", { width: 300, height: 200 });
    const pedir = vi.fn(async () => new Response(PNG));
    await medirImagenes(arbol(imagen), { origen, pedir });

    expect(imagen.properties).toMatchObject({ width: 300, height: 200 });
    expect(pedir).not.toHaveBeenCalled();
  });

  it("resuelve una ruta relativa contra el origen del sitio", async () => {
    const pedir = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(PNG),
    );
    await medirImagenes(arbol(img("/imagenes/a.png")), { origen, pedir });
    expect(String(pedir.mock.calls[0][0])).toBe(
      "https://markidev.com/imagenes/a.png",
    );
  });

  it("pide una sola vez la misma imagen repetida", async () => {
    const a = img("https://img.test/a.png");
    const b = img("https://img.test/a.png");
    const pedir = vi.fn(async () => new Response(PNG));
    await medirImagenes(arbol(a, b), { origen, pedir });

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(b.properties).toMatchObject({ width: 1200, height: 630 });
  });

  it("devuelve las que no pudo medir, sin repetir, y las deja sin medidas", async () => {
    const rota = img("https://img.test/rota.png");
    const svg = img("https://img.test/logo.svg");
    const sinMedir = await medirImagenes(
      arbol(rota, svg, img("https://img.test/rota.png")),
      {
        origen,
        pedir: async (url) =>
          String(url).endsWith(".svg")
            ? new Response("<svg/>")
            : new Response("no", { status: 404 }),
      },
    );

    expect(sinMedir).toEqual([
      "https://img.test/rota.png",
      "https://img.test/logo.svg",
    ]);
    expect(rota.properties).not.toHaveProperty("width");
  });

  it("no pide lo que no es http ni https", async () => {
    const pedir = vi.fn(async () => new Response(PNG));
    const sinMedir = await medirImagenes(arbol(img("ftp://img.test/a.png")), {
      origen,
      pedir,
    });
    expect(pedir).not.toHaveBeenCalled();
    expect(sinMedir).toEqual(["ftp://img.test/a.png"]);
  });

  it("mide como mucho 20 imagenes distintas; las demas quedan sin medir", async () => {
    const imagenes = Array.from({ length: 23 }, (_, i) =>
      img(`https://img.test/${i}.png`),
    );
    const pedir = vi.fn(async () => new Response(PNG));
    const sinMedir = await medirImagenes(arbol(...imagenes), { origen, pedir });

    expect(pedir).toHaveBeenCalledTimes(20);
    expect(sinMedir).toEqual([
      "https://img.test/20.png",
      "https://img.test/21.png",
      "https://img.test/22.png",
    ]);
  });

  it("las pide en paralelo, no una detras de otra", async () => {
    let enVuelo = 0;
    let maximo = 0;
    const pedir = async () => {
      enVuelo++;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, 10));
      enVuelo--;
      return new Response(PNG);
    };
    await medirImagenes(
      arbol(img("https://img.test/a.png"), img("https://img.test/b.png")),
      {
        origen,
        pedir,
      },
    );
    expect(maximo).toBe(2);
  });
});

describe("describirSinMedir", () => {
  it("nada que decir si se midieron todas", () => {
    expect(describirSinMedir([])).toBe("");
  });

  it("en singular con una", () => {
    expect(describirSinMedir(["https://img.test/a.png"])).toBe(
      "No se pudo medir 1 imagen (el texto puede saltar al cargarla): https://img.test/a.png.",
    );
  });

  it("en plural con varias", () => {
    expect(describirSinMedir(["https://a.test/1.png", "https://a.test/2.png"])).toBe(
      "No se pudieron medir 2 imágenes (el texto puede saltar al cargarlas): https://a.test/1.png, https://a.test/2.png.",
    );
  });

  it("nombra como mucho 5 y cuenta el resto, para no inflar la URL del aviso", () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://a.test/${i}.png`);
    expect(describirSinMedir(urls)).toBe(
      "No se pudieron medir 8 imágenes (el texto puede saltar al cargarlas): " +
        "https://a.test/0.png, https://a.test/1.png, https://a.test/2.png, " +
        "https://a.test/3.png, https://a.test/4.png y 3 más.",
    );
  });
});
