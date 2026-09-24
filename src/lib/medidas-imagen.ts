// Ancho y alto de una imagen leidos de su cabecera, sin decodificarla
// (`specs/medidas-de-imagenes.md`). Se le pasan los primeros bytes del archivo
// —como mucho 128 KB— y devuelve las medidas o `null`. Nunca lanza: una imagen
// que no se puede medir se queda sin medidas, no tumba el guardado.
//
// Codigo propio y no una libreria porque las que hay para Node leen del disco o
// usan `Buffer`, y en el Worker no hay ni lo uno ni lo otro (`nodejs_compat`
// esta apagado a proposito). Son cuatro formatos y unas pocas lineas cada uno.

export interface Medidas {
  ancho: number;
  alto: number;
}

export function medidasDeImagen(datos: Uint8Array): Medidas | null {
  const lector = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const medidas =
    png(datos, lector) ??
    gif(datos, lector) ??
    jpeg(datos, lector) ??
    webp(datos, lector);
  // Una imagen de 0 px de lado es un archivo roto, no una medida util.
  return medidas && medidas.ancho > 0 && medidas.alto > 0 ? medidas : null;
}

function empiezaCon(datos: Uint8Array, firma: number[], desde = 0): boolean {
  return firma.every((byte, i) => datos[desde + i] === byte);
}

const ascii = (texto: string) => [...texto].map((c) => c.charCodeAt(0));

// Firma de 8 bytes, y el primer bloque siempre es IHDR con ancho y alto en
// big-endian.
function png(datos: Uint8Array, lector: DataView): Medidas | null {
  if (datos.length < 24) return null;
  if (!empiezaCon(datos, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return null;
  if (!empiezaCon(datos, ascii("IHDR"), 12)) return null;
  return { ancho: lector.getUint32(16), alto: lector.getUint32(20) };
}

// El «logical screen» justo despues de la firma, en little-endian.
function gif(datos: Uint8Array, lector: DataView): Medidas | null {
  if (datos.length < 10) return null;
  if (
    !empiezaCon(datos, ascii("GIF87a")) &&
    !empiezaCon(datos, ascii("GIF89a"))
  )
    return null;
  return { ancho: lector.getUint16(6, true), alto: lector.getUint16(8, true) };
}

// Un JPEG es una fila de segmentos `FF xx` con su longitud. Las medidas estan en
// el primer SOF (Start Of Frame), que puede venir despues de un EXIF largo, asi
// que hay que ir saltando segmento a segmento.
function jpeg(datos: Uint8Array, lector: DataView): Medidas | null {
  if (!empiezaCon(datos, [0xff, 0xd8])) return null;

  let pos = 2;
  while (pos + 4 <= datos.length) {
    if (datos[pos] !== 0xff) return null;
    const marcador = datos[pos + 1];

    // Bytes de relleno entre segmentos.
    if (marcador === 0xff) {
      pos += 1;
      continue;
    }
    // Marcadores sin longitud (RST0-7, SOI, EOI, TEM).
    if ((marcador >= 0xd0 && marcador <= 0xd9) || marcador === 0x01) {
      pos += 2;
      continue;
    }

    const longitud = lector.getUint16(pos + 2);
    // Una longitud menor que la propia cabecera haria que el bucle no avanzara.
    if (longitud < 2) return null;

    // SOF0 a SOF15, salvo DHT (C4), JPG (C8) y DAC (CC), que comparten rango
    // pero no son cuadros.
    const esSof =
      marcador >= 0xc0 &&
      marcador <= 0xcf &&
      marcador !== 0xc4 &&
      marcador !== 0xc8 &&
      marcador !== 0xcc;
    if (esSof) {
      if (pos + 9 > datos.length) return null;
      return {
        alto: lector.getUint16(pos + 5),
        ancho: lector.getUint16(pos + 7),
      };
    }

    pos += 2 + longitud;
  }
  return null;
}

// Contenedor RIFF. El primer bloque dice que variante es y cada una guarda las
// medidas a su manera.
function webp(datos: Uint8Array, lector: DataView): Medidas | null {
  if (datos.length < 21) return null;
  if (!empiezaCon(datos, ascii("RIFF")) || !empiezaCon(datos, ascii("WEBP"), 8))
    return null;

  // Con perdida: tras 3 bytes de etiqueta y el codigo de inicio 9D 01 2A, dos
  // valores de 14 bits (los 2 de arriba son la escala, que no cambia el tamaño).
  if (empiezaCon(datos, ascii("VP8 "), 12)) {
    if (datos.length < 30 || !empiezaCon(datos, [0x9d, 0x01, 0x2a], 23))
      return null;
    return {
      ancho: lector.getUint16(26, true) & 0x3fff,
      alto: lector.getUint16(28, true) & 0x3fff,
    };
  }

  // Sin perdida: firma 0x2F y luego ancho-1 y alto-1 en 14 bits cada uno.
  if (empiezaCon(datos, ascii("VP8L"), 12)) {
    if (datos.length < 25 || datos[20] !== 0x2f) return null;
    const bits = lector.getUint32(21, true);
    return { ancho: (bits & 0x3fff) + 1, alto: ((bits >>> 14) & 0x3fff) + 1 };
  }

  // Extendido (con transparencia o animacion): el lienzo, ancho-1 y alto-1 en
  // 24 bits little-endian.
  if (empiezaCon(datos, ascii("VP8X"), 12)) {
    if (datos.length < 30) return null;
    const le24 = (i: number) =>
      datos[i] | (datos[i + 1] << 8) | (datos[i + 2] << 16);
    return { ancho: le24(24) + 1, alto: le24(27) + 1 };
  }

  return null;
}
