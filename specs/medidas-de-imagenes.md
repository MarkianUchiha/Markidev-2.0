# Medidas de las imágenes del blog

Estado: **aprobada** el 2026-09-23.
Issue: [M-248](https://linear.app/markidev/issue/M-248).
Decisión de fondo del dueño (2026-09-23): **medir al subir** (opción A). El sitio
aloja lo mínimo; el contenido dinámico se incrusta por URL, así que las imágenes
de los artículos vivirán casi siempre en otro servidor.

## Qué es

Al subir un `.md`, cada imagen del artículo queda en el HTML guardado con su
`width` y su `height` reales, sin que quien escribe tenga que ponerlos. Así el
navegador reserva el hueco antes de que llegue la imagen y el texto no salta.

**Qué no es:** alojar, recortar ni optimizar imágenes. Tampoco cambia cómo se
escribe: `![alt](https://…)` sigue siendo la forma normal.

## Por qué hace falta

La sintaxis de imagen de markdown no puede expresar dimensiones, así que hoy
cada `<img>` nace sin ellas (causa corregida en M-248: no es el saneado, que sí
las deja pasar). Sin dimensiones la página salta al cargar la imagen (CLS), que
cuenta en Core Web Vitals, y quien lee pierde el renglón.

## Cómo funciona

El HTML ya se genera **una vez, al subir** (`aHtml`, `src/lib/frontmatter.ts`),
y se guarda en `posts.html`. La medición se hace en ese mismo paso, como un paso
más de la cadena de rehype, **después del saneado**: solo se miden las imágenes
que sobrevivieron y los atributos los pone este código, no el autor.

Por cada `<img>` que no traiga ya `width` y `height`:

1. Resolver el `src`. Una ruta relativa (`/imagen.jpg`) se resuelve contra el
   origen del sitio; solo se piden `http` y `https`.
2. Pedir la imagen con `Accept: image/jpeg, image/png, image/gif, image/webp`.
   Un CDN que negocia formato no mandará AVIF, y las medidas son las mismas en
   cualquier formato.
3. Leer **como mucho los primeros 128 KB** y cortar la descarga. Con
   `Range: bytes=0-131071` si el servidor lo acepta; si no lo acepta, se lee el
   flujo y se cancela al llegar al tope.
4. Sacar ancho y alto de la cabecera del archivo.
5. Escribir `width` y `height` en el `<img>`.

Si el autor ya escribió `width` y `height` en un `<img>` de HTML crudo, **se
respetan** y esa imagen no se pide.

### Formatos

| Formato | Dónde están las medidas                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| PNG     | Bloque `IHDR`, bytes 16–23                                                               |
| GIF     | Bytes 6–9 (little-endian)                                                                |
| JPEG    | El primer marcador `SOF0`–`SOF15` (salvo `DHT`, `JPG`, `DAC`), recorriendo los segmentos |
| WebP    | Según el tipo de bloque: `VP8 `, `VP8L` o `VP8X`                                         |

Cualquier otro formato (SVG, AVIF que se cuele, algo roto) se queda **sin
medidas**, igual que hoy. No es un error.

### Límites

- **3 segundos por imagen**, con `AbortSignal.timeout`.
- **Todas en paralelo**: el tiempo de la subida es el de la imagen más lenta, no
  la suma.
- **Como mucho 20 imágenes medidas** por artículo; el resto se queda sin
  medidas. Un artículo de este blog lleva pocas y el tope evita que una subida
  dispare cientos de peticiones.
- Una imagen que falla (404, tiempo agotado, formato desconocido) **nunca
  impide guardar el artículo**.

### El aviso

Si alguna imagen se quedó sin medir, el aviso de la subida lo dice, con su
URL:

> Se subió «Título». No se pudieron medir 2 imágenes (el texto puede saltar al
> cargarlas): https://…/a.jpg, https://…/b.png

Sin nombrar el motivo técnico: el arreglo es el mismo en todos los casos
(revisar que la URL abra, o poner `width` y `height` a mano).

## Seguridad

El Worker pide URLs que escribió el autor. El riesgo es bajo: la subida está
detrás de Access, los Workers no alcanzan redes privadas, solo se aceptan
`http` y `https`, y cada petición tiene tope de tiempo y de bytes. La respuesta
no se guarda ni se reenvía: solo se leen cuatro números de su cabecera.

## Fuera de alcance

- Remedir los artículos ya subidos. Se corrigen volviéndolos a subir; hoy hay
  uno.
- `loading="lazy"`: ayuda con las imágenes de abajo, pero en la primera imagen
  empeora el LCP. Va en otra decisión.
- Alojar u optimizar imágenes (R2, Cloudflare Images).
- Medir en la edición del panel: la pantalla de M-234 no cambia el cuerpo, así
  que no regenera el HTML.

## Criterios de aceptación

1. Un `.md` con `![alt](url)` de un JPEG, un PNG, un GIF y un WebP reales se
   guarda con `width` y `height` correctos en los cuatro `<img>`.
2. Una imagen en `<img>` con `width` y `height` escritos por el autor conserva
   los suyos y no se pide.
3. Una imagen que da 404, otra que tarda más de 3 s y un SVG: el artículo se
   guarda, esas tres quedan sin medidas y el aviso las nombra.
4. Un servidor que ignora `Range` y manda la imagen entera: se mide igual y no
   se leen más de 128 KB.
5. En la página del artículo la imagen no se deforma ni desborda en 390 px de
   ancho (`max-width: 100%` y `height: auto` activos).
6. Tests de Vitest para el lector de cabeceras de los cuatro formatos, con
   casos rotos y truncados. `pnpm check && pnpm test` en verde.

## Cambios que implica

- `src/lib/medidas-imagen.ts`: el lector de cabeceras, puro, con sus tests.
- Un paso de rehype en `src/lib/frontmatter.ts`, después del saneado, que pide
  y mide. `aHtml` pasa a devolver también las URLs que no se pudieron medir.
- `src/pages/api/panel/contenido/index.ts`: el aviso con las imágenes sin medir.
