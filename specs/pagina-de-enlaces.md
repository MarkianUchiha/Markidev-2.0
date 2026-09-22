# Página de enlaces para redes

Estado: **aprobada** el 2026-09-21. El diseño del enlace, que quedó pendiente
entonces, se decidió el 2026-09-22 (ver _Diseño del enlace_).
Issue: [M-214](https://linear.app/markidev/issue/M-214).

## Qué es

Una página de enlaces **que cambian seguido**: lo que se está moviendo esta
semana. Una campaña de donación, un producto que se recomienda, el sitio de un
cliente que se acaba de entregar, el artículo del blog que acompaña a un video.
Se pega en la biografía de las redes y se administra desde el panel, sin tocar
código ni desplegar.

**Qué no es:** una página fija con los destinos de siempre. Esos ya están en el
menú del sitio. Si un enlace lleva meses sin moverse, probablemente sobra aquí.

## Estructura de la página

1. **Logo**: la placa del logotipo.
2. **«MarkiDev»**, en Poppins 700.
3. **Los enlaces**, en el orden que se definió en el panel: el primero destacado
   y el resto en botones (ver _Diseño del enlace_).
4. **Iconos de redes**, en este orden de prioridad: TikTok, X, Instagram, GitHub
   y Web (la portada de `markidev.com`). Es el mismo orden que el menú y el pie
   (`socialLinks` de `site.ts`). Facebook no va, ni aquí ni en ningún lado del
   sitio.

Nada más: sin menú, sin pie, sin retrato y sin texto de presentación.

## Qué guarda cada enlace

| Campo       | Obligatorio | Regla                                                                                                                                                                                              |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título      | Sí          | 1 a 80 caracteres. Es lo que se lee en el botón                                                                                                                                                    |
| URL         | Sí          | Solo `https://` o `http://`, o una ruta interna que empiece con `/` y lleve barra final. Cualquier otro esquema (`javascript:`, `data:`) se rechaza                                                |
| Descripción | No          | Hasta 120 caracteres. Una línea de contexto debajo del título, si el diseño elegido la usa                                                                                                         |
| Visible     | Sí          | Encendido o apagado. Apagar un enlace lo saca de la página sin borrarlo                                                                                                                            |
| Vence       | No          | Una fecha. Pasada esa fecha el enlace deja de mostrarse solo, sin que nadie tenga que acordarse. Es la defensa contra el polvo: una campaña de donación o una promoción se cargan con fecha de fin |
| Orden       | Sí          | La posición en la lista. Se cambia desde el panel                                                                                                                                                  |

**Imágenes: fuera de esta versión.** Una miniatura por enlace obliga a subir y
guardar archivos, y el proyecto no tiene almacenamiento de archivos (R2) todavía.
Si el diseño elegido las necesita, se hace una spec aparte.

## En el panel: `/panel/enlaces/`

- **Lista** de todos los enlaces con su estado: visible, oculto o vencido.
- **Crear y editar** en un formulario con los campos de arriba. La validación
  corre en el servidor; lo que se valide en el navegador es solo ayuda.
- **Mostrar u ocultar** con un botón, sin abrir el formulario.
- **Reordenar** con botones de subir y bajar. Nada de arrastrar: funciona sin
  JavaScript y con teclado.
- **Borrar**, con confirmación en una segunda pantalla, no con un diálogo del
  navegador.
- **Un enlace directo a la página pública** para revisar cómo quedó.
- Entrada en la navegación del panel junto a Leads y Contenido.

Queda detrás de Cloudflare Access, como el resto del panel, y los `POST` siguen
la misma protección que los del blog.

## La página pública: `/enlaces/`

- Se arma en cada petición desde D1, como el blog. Borde con
  `s-maxage=60, stale-while-revalidate=600`: un cambio en el panel se ve en
  público en un minuto como máximo.
- Muestra los visibles y no vencidos, en su orden.
- **Sin enlaces que mostrar**, queda el logo, el nombre y las redes. No aparece
  ningún mensaje de «no hay enlaces».
- Los enlaces externos abren en pestaña nueva con `rel="noopener noreferrer"`,
  y los internos en la misma.
- **`noindex` y fuera del sitemap.** Es una página de paso y cambia cada semana:
  indexada, Google guardaría enlaces que ya no existen.
- Sigue el tema del sitio: oscuro de entrada, y claro si el visitante ya lo
  había elegido.

## Decisiones

| Tema         | Decisión                                      | Por qué                                                                                                                                                           |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dirección    | `/enlaces/`                                   | Las rutas del sitio van en español. Sin la barra final, producción ya responde 301 a la versión con barra, así que `markidev.com/enlaces` sirve para la biografía |
| Dónde viven  | Tabla `enlaces` en D1, migración `0003`       | Tienen que cambiar sin desplegar                                                                                                                                  |
| Contar clics | Fuera de esta versión                         | No se pidió. Si se quiere, se agrega después con una ruta intermedia que cuente y redirija, sin tocar la tabla                                                    |
| Redes y web  | Las de `socialLinks` en `site.ts`, más la web | Cambian poco y el panel no las necesita. Una sola lista mantiene el mismo orden en el menú, el pie y esta página                                                  |

## Diseño del enlace

Decidido el 2026-09-22 entre las tres formas que se plantearon: botón de ancho
completo, tarjeta con descripción, y destacado arriba del resto. **Gana el
destacado**, porque le da jerarquía a «lo de esta semana», que es la razón de ser
de la página.

- **El primero de la lista** se pinta con el botón de acción —morado con texto
  verde—, 120px de alto. Ese par se ve igual en claro y en oscuro, así que el
  destacado no cambia con el tema.
- **Los demás**, botones de 56px con contorno naranja sobre la superficie.
- **La descripción** sale debajo del título, solo en los enlaces que la tienen.
  Un enlace con descripción mide 70px en vez de 56.
- **El nombre** va en `text-card` (30px) y no en `text-title`: a 17px se pierde
  debajo de un isotipo de 56.

Todo sale de tokens que ya existen. Mínimo **56px** de alto por enlace, por
encima de los 44 de área táctil.

**Que la lista se desplace no es un defecto.** Decisión del 2026-09-22: lo que
queda abajo del pliegue sirve para medir intención —quien baja a buscar un enlace
lo quería de verdad—, así que el diseño no se aprieta para que quepa todo. Lo que
sí se exige es que el logo, el nombre y el destacado se vean sin desplazarse: si
el primer enlace no entra, la página no cumple su trabajo.

Para calibrar: con este espaciado, cinco enlaces —uno con descripción— suman
706px en un viewport de 390×664.

## Pendiente de datos

- **X usa por ahora la cuenta `x.com/LaNetflix`**, que lleva un nombre ajeno a
  la marca. El dueño la va a renombrar; entonces cambia la URL en `site.ts`.

## Criterios de aceptación

1. Un enlace creado en el panel aparece en `/enlaces/` en menos de un minuto,
   sin desplegar.
2. Ocultar un enlace o que pase su fecha de vencimiento lo quita de la página
   pública, y en el panel sigue ahí con ese estado.
3. El panel rechaza una URL con esquema distinto de `http` o `https` y un
   título vacío o de más de 80 caracteres, aunque la petición no venga del
   formulario.
4. Subir y bajar cambia el orden en la página pública.
5. En 390×664, que es lo visible dentro del navegador de Instagram, se ven sin
   desplazarse el logo, el nombre y el enlace destacado. Que el resto de la
   lista quede abajo es correcto (ver _Diseño del enlace_).
6. Cada enlace mide al menos 56px de alto y se recorre con Tab con el foco
   visible.
7. `/enlaces/` lleva `noindex`, no aparece en el sitemap y no carga el menú ni
   el pie.
8. Sin la sesión de Access, `/panel/enlaces/` y su API no responden.
9. `pnpm check` pasa, y los tests también.

## Tests

Esta es la primera feature con lógica propia desde que se declaró el nivel SDD
Medio, así que trae el andamiaje: **Vitest**, que es el runner que Astro
documenta para sus proyectos. Se escriben primero los tests de las funciones
puras de `src/lib/enlaces.ts`:

- La validación de un enlace: esquemas permitidos, rutas internas, límites de
  longitud y fechas.
- El filtro de lo que se muestra: visible, no vencido y en orden.

El comando de verificación pasa a ser `pnpm check && pnpm test`, y se actualiza
`CLAUDE.local.md`.

## Cambios que implica

- `migrations/0003_enlaces.sql`.
- `src/lib/enlaces.ts` con la validación y el filtro, y sus tests.
- Funciones de consulta en `src/lib/db.ts`.
- `src/pages/panel/enlaces/` y `src/pages/api/panel/enlaces/`.
- `src/pages/enlaces.astro`.
- `Layout.astro` gana dos props opcionales, `sinNavegacion` y `noindex`. Las
  demás páginas no cambian.
- El filtro del sitemap excluye `/enlaces/`.
- Las redes salen de `socialLinks` de `site.ts`; la web se agrega en la página.
