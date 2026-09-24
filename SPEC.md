# MarkiDev 2.0 — Especificación del producto

Estado: **descriptiva**, escrita el 2026-09-23. Dice lo que el sitio hace hoy,
comprobado contra el código, no lo que debería hacer. Lo que no se pudo
comprobar va marcado `[SIN VERIFICAR]`. Cuando una feature nueva cambie algo de
aquí, este documento se actualiza en el mismo cambio.

Las features grandes tienen su spec en `specs/` y las decisiones de fondo están
en `Decisiones.md`; aquí se enlazan en vez de repetirse.

## Qué es

El sitio de un estudio de una sola persona que digitaliza negocios (sistemas a
la medida, puntos de venta, pedidos por WhatsApp, sitios web) y su panel de
operaciones. Tiene dos trabajos:

1. **Captar prospectos**: explicar qué se hace, enseñar casos y convertir la
   visita en un mensaje.
2. **Operarlos**: llevar cada prospecto por un tablero de ventas, publicar el
   blog y mantener la página de enlaces de las redes.

Alcance comercial declarado: México y Latinoamérica.

## Parte pública

| Ruta                               | Qué muestra                                                                | De dónde salen los datos                          | Render                                    |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `/`                                | Propuesta, servicios, trabajos, testimonios, proceso y llamada a contactar | Colecciones de `src/content` y `src/data/site.ts` | Prerenderizada                            |
| `/trabajos/` y `/trabajos/<caso>/` | Casos con cliente, año, servicios y resultado                              | Colección `work`                                  | Prerenderizada                            |
| `/sobre-mi/`                       | Perfil del autor                                                           | Página                                            | Prerenderizada                            |
| `/blog/` y `/blog/<slug>/`         | Artículos publicados                                                       | D1 (`posts`), ver [blog](#blog)                   | Servidor, caché de borde 60 s             |
| `/enlaces/`                        | Enlaces para las redes, el primero destacado                               | D1 (`enlaces`), solo visibles y no vencidos       | Servidor                                  |
| `/contacto/`                       | Formulario, ver [contacto](#contacto)                                      | —                                                 | Servidor (necesita la llave de Turnstile) |
| `/aviso-de-privacidad/`            | Aviso de privacidad                                                        | Página                                            | Prerenderizada                            |
| 404                                | Página de error con menú y salidas                                         | —                                                 | Servidor                                  |

Todas las URLs internas llevan barra final (`trailingSlash: "always"`). El
tema es oscuro por defecto; el botón alterna a claro y lo recuerda en
`localStorage`.

### <a id="contacto"></a>Formulario de contacto

`src/pages/api/contacto.ts`.

- **Campos:** nombre, contacto (correo o teléfono), mensaje y la aceptación del
  aviso de privacidad. Se validan en el servidor.
- **Antibot:** un campo trampa (`empresa`) que, si llega lleno, finge éxito sin
  guardar nada; y Cloudflare Turnstile cuando hay llave configurada.
- **Orden no negociable:** primero se guarda el prospecto en D1 y después se
  avisa por correo con Resend. Si el aviso falla, el prospecto ya está en el
  tablero y a quien escribió no se le dice nada: hacerle reenviar lo duplicaría.
  Si lo que falla es guardar, se le pide escribir por WhatsApp.

### <a id="blog"></a>Blog

Los artículos se suben como `.md` desde el panel y viven en D1
([Decisiones 004](Decisiones.md#004)). La URL sale del nombre del archivo. Una
URL que cambió redirige con 301 a la nueva ([014](Decisiones.md#014)). Las
imágenes se guardan con su ancho y alto ([015](Decisiones.md#015)). Un
artículo oculto responde como si no existiera.

## Panel

Todo `/panel/` y `/api/panel/` está detrás de Cloudflare Access, y cada ruta
comprueba además al usuario ([Decisiones 002](Decisiones.md#002)). El panel
siempre se ve en tema oscuro.

### Prospectos (`/panel/`)

Un tablero de columnas que se arrastran (`src/lib/pipeline.ts`):

- **Siete etapas:** Nuevo, Calificando, Propuesta, Negociación y Retomar son las
  activas; Ganado y Descartado son el archivo. Cada una define qué tiene que
  pasar para salir de ella.
- **Canales de origen:** formulario, WhatsApp, correo, agenda y referido.
- **Datos del prospecto:** nombre, contacto, canal, mensaje, etapa, valor
  estimado, esquema de pago y, según la etapa, el motivo de descarte o la fecha
  para retomar. **Esos dos son obligatorios en su etapa y los exige la propia
  base** (`CHECK` en `migrations/0001_leads.sql:28-29`): no se puede descartar
  sin motivo ni mandar a Retomar sin fecha.
- **Alta manual:** para quien llega por WhatsApp o recomendado, que no pasa por
  el formulario. Es tan importante como el formulario: el cliente que más
  factura llega así.
- **Historial:** cada alta y cada cambio de etapa queda en `lead_eventos`, con
  quién lo hizo.

### Contenido (`/panel/contenido/`)

Subir, ver en vista previa, editar título/descripción/URL, bajar el `.md`,
publicar u ocultar y borrar artículos. Detalle en
`specs/vista-previa-de-articulos.md`, `specs/editar-articulo.md` y
`specs/medidas-de-imagenes.md`.

### Enlaces (`/panel/enlaces/`)

Alta, edición, orden, visibilidad y fecha de vencimiento de los enlaces de
`/enlaces/`. Detalle en `specs/pagina-de-enlaces.md`.

## Integraciones

| Servicio                | Para qué                                                                   | Configuración que espera (solo nombres)      |
| ----------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Cloudflare Workers + D1 | Hospedaje y base de datos                                                  | Binding `DB`                                 |
| Cloudflare Access       | Acceso al panel                                                            | `TEAM_DOMAIN`, `POLICY_AUD`                  |
| Cloudflare Turnstile    | Antibot del formulario                                                     | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Resend                  | Aviso por correo de cada prospecto nuevo                                   | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO` |
| Google Calendar         | Página de reservas enlazada desde el sitio; no hay integración de servidor | Enlace en `src/data/site.ts`                 |

## Descubrimiento

- **Sitemaps:** `sitemap-index.xml` con las páginas del build, y
  `sitemap-blog.xml` generado al pedirlo con los artículos publicados.
- **`robots.txt`:** deja pasar a los rastreadores que citan con enlace
  (buscadores y buscadores con IA) y bloquea a los que solo recogen para
  entrenar. Declara `Content-Signal: search=yes, ai-train=no`. `/panel` está
  vedado.
- **`llms.txt`:** resumen del sitio con páginas, casos y artículos publicados,
  generado en cada petición.
- **JSON-LD** (`src/lib/schema.ts`): `Organization`, `Person`, `BlogPosting`
  para artículos, `Article` para casos y `BreadcrumbList`.

## Datos personales

El aviso de privacidad declara que solo se guardan nombre, correo o teléfono y
mensaje de quien escribe por el formulario; que viven en Cloudflare y el aviso
pasa por Resend; y que se conservan hasta dos años después del último contacto.
**Coincide con lo que el formulario guarda de verdad** (tabla `leads`: nombre,
contacto, mensaje y el canal «formulario»).

`[SIN VERIFICAR]` El aviso dice «la analítica que uso no registra tu
identidad», pero el código no carga ninguna analítica. O está activada desde el
panel de Cloudflare (Web Analytics se inyecta sin tocar el código), o el aviso
describe algo que no existe. Hay que comprobarlo en el panel de Cloudflare.

## Qué no hace

- No cobra ni vende: no hay pagos. Genera prospectos.
- No tiene cuentas de visitantes: el único acceso es el panel, para una persona.
- No cuenta clics de `/enlaces/` (fuera de alcance en su spec).
- No tiene lista de correo; el aviso dice que, si algún día la hay, será con una
  casilla aparte.
- No edita el cuerpo de un artículo desde el panel: eso va por archivo.
- No remide las imágenes de artículos ya subidos: hay que volver a subirlos.

## Incoherencias abiertas

1. **El campo `question` del frontmatter** se valida, se guarda y viaja en
   «Bajar .md», pero ninguna página lo usa. Falta decidir si se le da uso (por
   ejemplo en el JSON-LD) o se quita.
2. **El canal «Agenda» se llama `calcom` por dentro**
   (`src/lib/pipeline.ts:84`, `migrations/0001_leads.sql:12`), pero la agenda
   del sitio es de Google Calendar (`src/data/site.ts:17-21`). Solo es el
   nombre interno; cambiarlo exige una migración por el `CHECK` de la tabla.
3. **El error del formulario lleva una tilde sin codificar en la cabecera
   `Location`** (`src/pages/api/contacto.ts:70`, «Escríbeme»). Es el mismo fallo
   que se corrigió en el panel el 2026-09-23. Chrome lo tolera, pero una
   cabecera HTTP no admite caracteres fuera de ASCII, y está justo en el camino
   de fallo más delicado: cuando el mensaje no se pudo guardar.
4. **La analítica del aviso de privacidad**, ver [datos personales](#datos-personales).
