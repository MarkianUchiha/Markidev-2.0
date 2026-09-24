# Decisiones

Registro de decisiones de arquitectura y de producto de MarkiDev 2.0: qué se
decidió, por qué y qué obliga a hacer. Una decisión nueva va aquí en el mismo
cambio que la aplica; una que se revierte no se borra, se marca **Reemplazada**
y apunta a la que la sustituye.

Escrito el 2026-09-23 a partir de las specs, el código y el historial. Las
decisiones anteriores a esa fecha se reconstruyeron de su commit y de los
comentarios del código que las explican; cada una cita su fuente.

## Índice

| #           | Decisión                                                          | Fecha      | Estado   |
| ----------- | ----------------------------------------------------------------- | ---------- | -------- |
| [001](#001) | Astro sobre Cloudflare Workers, con D1                            | 2026-09-03 | Aceptada |
| [002](#002) | El panel vive detrás de Cloudflare Access                         | 2026-09-08 | Aceptada |
| [003](#003) | Sin `nodejs_compat` ni WebAssembly en el Worker                   | 2026-09-20 | Aceptada |
| [004](#004) | El contenido del blog vive en D1, no en el repositorio            | 2026-09-20 | Aceptada |
| [005](#005) | El HTML del artículo se genera al guardar, no al servir           | 2026-09-20 | Aceptada |
| [006](#006) | El slug es la clave primaria de `posts`                           | 2026-09-20 | Aceptada |
| [007](#007) | Despliegue manual, sin CI; migraciones antes del deploy           | 2026-09-23 | Aceptada |
| [008](#008) | Convenciones de nombres, URLs y colores                           | 2026-09-03 | Aceptada |
| [009](#009) | Tipografía: mismas familias, otra escala                          | 2026-09-21 | Aceptada |
| [010](#010) | Los enlaces de redes viven en D1                                  | 2026-09-21 | Aceptada |
| [011](#011) | Un error y una confirmación se distinguen por forma, no por color | 2026-09-22 | Aceptada |
| [012](#012) | La vista previa es una ruta del panel, sin caché                  | 2026-09-22 | Aceptada |
| [013](#013) | Al editar un artículo, el último en guardar gana                  | 2026-09-23 | Aceptada |
| [014](#014) | Una URL vieja de artículo redirige con 301                        | 2026-09-23 | Aceptada |
| [015](#015) | Las imágenes del blog se miden al subir                           | 2026-09-23 | Aceptada |
| [016](#016) | La descripción de un artículo pide al menos 70 caracteres         | 2026-09-23 | Aceptada |

---

## <a id="001"></a>001 · Astro sobre Cloudflare Workers, con D1

**Decisión.** El sitio es Astro 7 con el adaptador de Cloudflare y corre como
Worker. Los datos que cambian sin desplegar (prospectos, contenido, enlaces)
viven en D1.

**Por qué.** `[SIN VERIFICAR]` El sitio se reinició desde cero el 2026-09-03
sobre esta base, pero el motivo no quedó escrito. Lo probable: Workers da
páginas del servidor sin mantener un servidor, y D1 queda en la misma cuenta y
el mismo despliegue que el Worker.

**Consecuencias.** Todo lo que corre en el Worker respeta los límites de
workerd ([003](#003)). Lo que toca D1 se verifica en `astro dev`, no en Vitest.

**Fuente.** `6a674fb` (reinicio con Astro 7), `5b175d0` (primer uso de D1).

## <a id="002"></a>002 · El panel vive detrás de Cloudflare Access

**Decisión.** Todo lo que cuelga de `/panel/` y `/api/panel/` exige una sesión
de Cloudflare Access. El middleware verifica el JWT de Access y, además, cada
página y endpoint del panel comprueba `Astro.locals.usuario` por su cuenta. En
`astro dev` hay un usuario local fijo.

**Por qué.** `[SIN VERIFICAR]` El motivo de Access no quedó escrito; lo
probable es evitar construir y mantener un sistema de acceso propio para un
panel de una sola persona. Lo que sí consta en el código: la comprobación doble hace que olvidar una ruta en
el middleware no la deje abierta.

**Consecuencias.** Para probar el panel en producción hace falta una sesión de
Access en el navegador. Abrir el panel a un empleado obliga a reevaluar el
nivel SDD del proyecto.

**Fuente.** `5b175d0`; `src/middleware.ts`.

## <a id="003"></a>003 · Sin `nodejs_compat` ni WebAssembly en el Worker

**Decisión.** `wrangler.jsonc` no activa `nodejs_compat`. Nada de lo que corre
en el Worker usa APIs de Node (`Buffer`, `fs`) ni genera WebAssembly.

**Por qué.** workerd no permite generar código Wasm en caliente («Wasm code
generation disallowed by embedder»). Por eso el resaltado de código usa el motor
de expresiones regulares de JavaScript de Shiki y no Oniguruma.

**Consecuencias.** Una librería que dependa de Node o de Wasm no sirve aquí.
Por eso el lector de medidas de imágenes es código propio ([015](#015)).

**Fuente.** `1455344`; comentarios de `src/lib/frontmatter.ts` y
`src/lib/medidas-imagen.ts`.

## <a id="004"></a>004 · El contenido del blog vive en D1, no en el repositorio

**Decisión.** Los artículos se suben como `.md` desde `/panel/contenido/` y se
guardan en la tabla `posts`. `src/content.config.ts` ya no define el blog: el
esquema del frontmatter vive solo en `src/lib/frontmatter.ts`.

**Por qué.** Publicar un artículo no debe requerir un commit ni un deploy.

**Consecuencias.**

- El contenido del blog **no viaja con el deploy**: se sube en producción.
- «Bajar .md» rehace el archivo desde la base, así que es la copia buena.
- Cada guardado deja la versión anterior en `post_revisiones`.

**Fuente.** `1455344`; `migrations/0002_contenido.sql`.

## <a id="005"></a>005 · El HTML del artículo se genera al guardar, no al servir

**Decisión.** Al subir, el markdown se convierte, se sanea y se guarda en
`posts.html`. Las páginas públicas solo leen y pintan. Orden de la cadena:
markdown → HTML (con el HTML crudo convertido en nodos) → saneado → medición de
imágenes → resaltado de código.

**Por qué.** Se procesa una vez por guardado, no una por visita, y el código
que procesa texto de un tercero queda detrás de Access. El saneado va después
de convertir porque lo que hay que limpiar es el HTML resultante. El resaltado
va después del saneado porque sus estilos los genera el propio código.

**Consecuencias.** Cambiar la cadena no afecta a lo ya publicado hasta volver a
subir cada artículo.

**Fuente.** `1455344`; `src/lib/frontmatter.ts`.

## <a id="006"></a>006 · El slug es la clave primaria de `posts`

**Decisión.** La URL del artículo (`/blog/<slug>/`) sale del nombre del
archivo y es la clave primaria. No hay un id sintético aparte.

**Por qué.** Un id sintético permitiría dos filas peleando por la misma URL.

**Consecuencias.** Cambiar la URL es cambiar la clave primaria, y
`post_revisiones` la referencia sin `ON UPDATE CASCADE`. Se resuelve con un
`batch` que crea la fila nueva, muda revisiones y redirecciones, y borra la
vieja ([014](#014)).

**Fuente.** `migrations/0002_contenido.sql`; `specs/editar-articulo.md`.

## <a id="007"></a>007 · Despliegue manual, sin CI; migraciones antes del deploy

**Decisión.** No hay integración continua: un `push` no publica nada. El orden
es `whoami` → `pnpm check && pnpm test` → migraciones remotas → deploy, y se
despliega una vez al cerrar cada tanda de trabajo.

**Por qué.** `[SIN VERIFICAR]` No consta por qué no hay CI; lo probable es el
control explícito de qué llega a producción y cuándo. La migración
va antes porque código nuevo que consulta una tabla que aún no existe fallaría.

**Consecuencias.** Producción se desfasa del repositorio en silencio si nadie
despliega; antes de planear trabajo nuevo conviene comparar lo publicado con lo
local. La migración remota responde «yes» sola fuera de una terminal
interactiva: hay que leer la lista que enseña.

**Fuente.** Procedimiento de despliegue del proyecto; el orden de la migración
se fijó el 2026-09-23 tras la revisión de M-234.

## <a id="008"></a>008 · Convenciones de nombres, URLs y colores

**Decisión.**

- Identificadores del DOM, del CSS y funciones de `src/lib` **en español**
  (`#abrir-menu`, `.tema-oscuro`, `redirigir`).
- **Toda URL interna lleva barra final**, incluidas las de `fetch` y `action`.
- Los colores se usan **por su token semántico**, nunca un hex en una
  plantilla. La paleta son cuatro colores con papel fijo y el texto de lectura
  nunca lleva color de marca.

**Por qué.** Es la convención que ya seguía el código. La barra final evita la
redirección de `/ruta` a `/ruta/`. Los tokens son los que cambian con el modo
oscuro; un hex suelto lo rompe.

**Fuente.** Guía de diseño del proyecto; `src/styles/global.css`.

## <a id="009"></a>009 · Tipografía: mismas familias, otra escala

**Decisión.** Se conservan Poppins (titulares), Open Sans (cuerpo) y Crimson Pro
(citas), con otra escala: titulares en Poppins 600 en vez de 700. Elegida entre
cinco alternativas comparadas en pantalla.

**Por qué.** El sitio se leía «cuadrado y conservador», y el peso de los
titulares era la causa principal. Cambiar de familia costaba más y obligaba a
rehacer toda la escala.

**Fuente.** `specs/tipografia-y-blog.md` (M-216).

## <a id="010"></a>010 · Los enlaces de redes viven en D1

**Decisión.** La página `/enlaces/` se alimenta de la tabla `enlaces`, que se
administra desde el panel. El primer enlace va destacado.

**Por qué.** Tienen que cambiar seguido (una campaña, un producto) sin
desplegar. El destacado da jerarquía a «lo de esta semana».

**Fuente.** `specs/pagina-de-enlaces.md` (M-214); `migrations/0003_enlaces.sql`.

## <a id="011"></a>011 · Un error y una confirmación se distinguen por forma, no por color

**Decisión.** El mensaje del panel lleva un icono y un rótulo corto: palomita y
«Listo», o signo de admiración y un rótulo que dice qué falló («No se subió»,
«No se borró»…). El rótulo lo decide el endpoint que conoce la acción.

**Por qué.** Ningún color de la paleta significa «bien» o «mal», y antes los dos
mensajes salían idénticos. Además se distinguen sin ver el color.

**Fuente.** M-235; `src/components/panel/Mensaje.astro`; `src/lib/redireccion.ts`.

## <a id="012"></a>012 · La vista previa es una ruta del panel, sin caché

**Decisión.** Un artículo, publicado u oculto, se previsualiza en
`/panel/contenido/<slug>/` con `Cache-Control: private, no-store`, usando el
mismo componente que la página pública.

**Por qué.** `/blog/<slug>/` se cachea en el borde. Si sirviera el borrador a
quien tiene sesión, el borde se lo daría a cualquiera durante un minuto.

**Fuente.** `specs/vista-previa-de-articulos.md` (M-233).

## <a id="013"></a>013 · Al editar un artículo, el último en guardar gana

**Decisión.** Editar título, descripción o URL en el panel y volver a subir el
`.md` son dos formas de escribir la misma fila: la que llega después pisa a la
anterior. El aviso de la subida dice qué cambió respecto a lo que había.

**Por qué.** «Bajar .md» rehace el archivo desde la base, así que quien baja
antes de editar trae lo corregido. Proteger campos dejaría el archivo y el sitio
diciendo cosas distintas.

**Consecuencias.** Subir una copia vieja revierte una corrección, pero el aviso
lo enseña y lo pisado queda en `post_revisiones`.

**Fuente.** `specs/editar-articulo.md` (M-234), decisión 1-A.

## <a id="014"></a>014 · Una URL vieja de artículo redirige con 301

**Decisión.** Cambiar la URL deja una redirección permanente en
`post_redirecciones`:

- Sin cadenas: al mover B → C, lo que llevaba a B pasa a llevar a C.
- Una URL nunca es a la vez artículo y redirección.
- Subir un archivo cuyo nombre es una URL vieja se rechaza.
- El 301 lleva `max-age=300`.
- Si la consulta falla, la página responde 404 en vez de 500.

**Por qué.** No romper enlaces compartidos y conservar lo ganado en buscadores.
Sin `max-age`, el navegador guarda un 301 para siempre, y volver a una URL
anterior dejaría a alguien en bucle.

**Fuente.** `specs/editar-articulo.md` (M-234), decisión 2-A;
`migrations/0004_redirecciones.sql`.

## <a id="015"></a>015 · Las imágenes del blog se miden al subir

**Decisión.** Al subir un artículo, cada imagen se pide y se leen su ancho y su
alto de la cabecera, para escribir `width` y `height` en el `<img>`:

- Como mucho 128 KB y 3 s por imagen, en paralelo, hasta 20 imágenes.
- Se respeta la orientación EXIF de los JPEG.
- Si el autor dio una sola medida, se conserva y la otra se calcula por
  proporción.
- Una imagen que falla nunca impide guardar: el aviso la nombra.

**Por qué.** El sitio aloja lo mínimo: el contenido dinámico se incrusta por
URL, así que las imágenes viven en otros servidores. Sin medidas el texto salta
al cargarlas (CLS).

**Consecuencias.** Los artículos subidos antes se corrigen volviéndolos a
subir. Límite aceptado: workerd deja 6 conexiones esperando cabeceras a la vez.

**Fuente.** `specs/medidas-de-imagenes.md` (M-248).

## <a id="016"></a>016 · La descripción de un artículo pide al menos 70 caracteres

**Decisión.** La descripción (la meta description) va de 70 a 160 caracteres.

**Por qué.** El máximo sí viene de Google, que corta por ancho hacia los
155-160 caracteres. **El mínimo es criterio del proyecto, no regla de Google**:
una descripción corta desperdicia el espacio del resultado, y Google tiende a
sustituirla por un trozo de la página que no eligió nadie.

**Consecuencias.** Se puede bajar sin romper nada si llega a estorbar.

**Fuente.** Decisión del dueño del 2026-09-23; `src/lib/frontmatter.ts`.
