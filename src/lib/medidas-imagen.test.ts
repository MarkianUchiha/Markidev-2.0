import { describe, expect, it } from "vitest";
import { medidasDeImagen } from "./medidas-imagen";

// Cabeceras armadas byte a byte segun cada formato, con medidas conocidas. Asi el
// test no depende de archivos binarios en el repositorio.

const ascii = (texto: string) => [...texto].map((c) => c.charCodeAt(0));
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [
  (n >>> 24) & 0xff,
  (n >> 16) & 0xff,
  (n >> 8) & 0xff,
  n & 0xff,
];
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const le32 = (n: number) => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >> 16) & 0xff,
  (n >>> 24) & 0xff,
];
const bytes = (...partes: number[][]) => new Uint8Array(partes.flat());

function png(ancho: number, alto: number) {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    ascii("IHDR"),
    be32(ancho),
    be32(alto),
    [8, 6, 0, 0, 0],
  );
}

function gif(ancho: number, alto: number) {
  return bytes(ascii("GIF89a"), le16(ancho), le16(alto), [0, 0, 0]);
}

// SOI, un APP1 (EXIF) de relleno para que el SOF no este al principio, y el SOF.
function jpeg(ancho: number, alto: number, { sof = 0xc0, relleno = 200 } = {}) {
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe1],
    be16(relleno + 2),
    new Array(relleno).fill(0),
    [0xff, 0xc4],
    be16(4),
    [0, 0],
    [0xff, sof],
    be16(17),
    [8],
    be16(alto),
    be16(ancho),
    [3],
  );
}

function riff(bloque: string, datos: number[]) {
  return bytes(
    ascii("RIFF"),
    le32(4 + 8 + datos.length),
    ascii("WEBP"),
    ascii(bloque),
    le32(datos.length),
    datos,
  );
}

// Tres bytes de etiqueta de cuadro, el codigo de inicio 9D 01 2A y las medidas.
const webpVp8 = (ancho: number, alto: number) =>
  riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(ancho), ...le16(alto)]);

function webpVp8l(ancho: number, alto: number) {
  // 14 bits de ancho-1 y 14 de alto-1, empaquetados en little-endian.
  const bits = (ancho - 1) | ((alto - 1) << 14);
  return riff("VP8L", [0x2f, ...le32(bits)]);
}

const webpVp8x = (ancho: number, alto: number) =>
  riff("VP8X", [0x10, 0, 0, 0, ...le24(ancho - 1), ...le24(alto - 1)]);

describe("medidasDeImagen", () => {
  it.each([
    ["PNG", png(1200, 630)],
    ["GIF", gif(1200, 630)],
    ["JPEG con EXIF y DHT antes del SOF", jpeg(1200, 630)],
    ["JPEG progresivo (SOF2)", jpeg(1200, 630, { sof: 0xc2 })],
    ["WebP con perdida (VP8)", webpVp8(1200, 630)],
    ["WebP sin perdida (VP8L)", webpVp8l(1200, 630)],
    ["WebP extendido (VP8X)", webpVp8x(1200, 630)],
  ])("lee %s", (_, datos) => {
    expect(medidasDeImagen(datos)).toEqual({ ancho: 1200, alto: 630 });
  });

  it("lee medidas grandes sin desbordar (PNG de 20000 × 15000)", () => {
    expect(medidasDeImagen(png(20000, 15000))).toEqual({
      ancho: 20000,
      alto: 15000,
    });
  });

  it("lee el maximo de VP8X (24 bits)", () => {
    expect(medidasDeImagen(webpVp8x(16_777_216, 1))).toEqual({
      ancho: 16_777_216,
      alto: 1,
    });
  });

  it.each([
    // Cada uno se corta un byte antes de que terminen sus medidas: lo que llega
    // tras un `Range` que el servidor corto mal.
    ["PNG", png(1200, 630).slice(0, 23)],
    ["GIF", gif(1200, 630).slice(0, 9)],
    ["JPEG", jpeg(1200, 630).slice(0, -2)],
    ["WebP VP8", webpVp8(1200, 630).slice(0, -1)],
    ["WebP VP8L", webpVp8l(1200, 630).slice(0, -1)],
    ["WebP VP8X", webpVp8x(1200, 630).slice(0, -1)],
  ])("devuelve null con un %s cortado dentro de las medidas", (_, datos) => {
    expect(medidasDeImagen(datos)).toBeNull();
  });

  it("devuelve null con un SVG", () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    );
    expect(medidasDeImagen(svg)).toBeNull();
  });

  it("devuelve null con basura, vacio o medidas cero", () => {
    expect(medidasDeImagen(new Uint8Array())).toBeNull();
    expect(medidasDeImagen(new Uint8Array(64).fill(0xff))).toBeNull();
    expect(medidasDeImagen(png(0, 630))).toBeNull();
  });

  it("no confunde DHT (FFC4) con un SOF", () => {
    // Solo DHT, sin SOF: no hay medidas.
    const soloDht = bytes([0xff, 0xd8], [0xff, 0xc4], be16(4), [0, 0]);
    expect(medidasDeImagen(soloDht)).toBeNull();
  });

  it("no se cuelga con un segmento JPEG de longitud cero", () => {
    const roto = bytes(
      [0xff, 0xd8],
      [0xff, 0xe1],
      be16(0),
      new Array(20).fill(0),
    );
    expect(medidasDeImagen(roto)).toBeNull();
  });
});

// Una foto de celular se guarda «acostada» y el EXIF dice como girarla. El
// navegador la gira, asi que las medidas tienen que salir ya giradas.
function jpegConOrientacion(
  ancho: number,
  alto: number,
  orientacion: number,
  orden: "II" | "MM" = "II",
) {
  const u16 = orden === "II" ? le16 : be16;
  const u32 = orden === "II" ? le32 : be32;
  const tiff = [
    ...ascii(orden),
    ...u16(42),
    ...u32(8),
    ...u16(1), // una entrada en el IFD0
    ...u16(0x0112), // Orientation
    ...u16(3), // SHORT
    ...u32(1),
    ...u16(orientacion),
    0,
    0,
    ...u32(0), // no hay siguiente IFD
  ];
  const app1 = [...ascii("Exif"), 0, 0, ...tiff];
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe1],
    be16(app1.length + 2),
    app1,
    [0xff, 0xc0],
    be16(17),
    [8],
    be16(alto),
    be16(ancho),
    [3],
  );
}

describe("medidasDeImagen · orientacion EXIF", () => {
  it.each([5, 6, 7, 8])("orientacion %i: intercambia ancho y alto", (o) => {
    expect(medidasDeImagen(jpegConOrientacion(800, 600, o))).toEqual({ ancho: 600, alto: 800 });
  });

  it.each([1, 2, 3, 4])("orientacion %i: las deja como estan", (o) => {
    expect(medidasDeImagen(jpegConOrientacion(800, 600, o))).toEqual({ ancho: 800, alto: 600 });
  });

  it("lee el EXIF big-endian (MM) igual que el little-endian (II)", () => {
    expect(medidasDeImagen(jpegConOrientacion(800, 600, 6, "MM"))).toEqual({ ancho: 600, alto: 800 });
  });

  it("un EXIF roto no impide medir: se toma sin girar", () => {
    const roto = jpegConOrientacion(800, 600, 6);
    roto[12] = 0x58; // estropea la marca de orden de bytes («II» → «XI»)
    expect(medidasDeImagen(roto)).toEqual({ ancho: 800, alto: 600 });
  });
});
