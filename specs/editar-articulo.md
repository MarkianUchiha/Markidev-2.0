# Editar título, descripción y URL de un artículo

Estado: **aprobada** el 2026-09-23.
Issue: [M-234](https://linear.app/markidev/issue/M-234).
Decisiones de fondo tomadas por el dueño el 2026-09-23: el último en guardar
gana (1-A) y la URL vieja redirige con 301 (2-A).

## Qué es

Una pantalla del panel para corregir, sobre un artículo ya subido, las tres
cosas que definen cómo se presenta: **título**, **descripción** y **URL**. Sin
bajar el `.md`, editarlo fuera y volverlo a subir.

**Qué no es:** un editor del cuerpo del artículo. El texto, las imágenes y el
resto del frontmatter (`pubDate`, `updatedDate`, `tags`, `question`) siguen
cambiándose por archivo.

## Por qué hace falta

Hoy corregir una errata del título son tres pasos y un editor de texto. Y
cambiar la URL ni siquiera funciona: el slug sale del nombre del archivo y es la
clave primaria de `posts` (`migrations/0002_contenido.sql:14`), así que subir
con otro nombre **crea un artículo aparte** y deja el viejo publicado.

## La pantalla: `/panel/contenido/<slug>/editar/`

Detrás de Access como el resto del panel, con la misma comprobación de
`usuario` que la vista previa. Se llega desde un botón «Editar» en la lista de
`/panel/contenido/`, que va después de «Ver».

Un formulario nativo, sin isla, con tres campos precargados:

| Campo       | Regla                                                    | De dónde sale                                     |
| ----------- | -------------------------------------------------------- | ------------------------------------------------- |
| Título      | Hasta 70 caracteres                                      | `esquemaBlog.title` (`frontmatter.ts:39`)         |
| Descripción | De 70 a 160 caracteres                                   | `esquemaBlog.description` (`frontmatter.ts:44`)   |
| URL         | 3 a 80 caracteres, minúsculas, números y guiones sueltos | `esquemaSlug` (`api/panel/contenido/index.ts:11`) |

Las reglas **no se copian**: se reutilizan los mismos esquemas de Zod que
valida la subida. `esquemaSlug` hoy es local del endpoint de subida y tiene que
moverse a `src/lib` para que lo usen los dos.

Si algo no pasa la validación, vuelve al formulario con lo escrito conservado y
el error arriba, igual que `/panel/enlaces/<id>/`. Si pasa, vuelve a la lista
con un aviso que dice qué cambió.

## Decisión 1: el último en guardar gana

Editar en el panel y subir un `.md` son dos formas de escribir la misma fila.
**La que llega después pisa a la anterior**, sin campos protegidos.

Funciona porque «Bajar .md» no entrega el archivo original sino que lo **arma
desde la base** (`aMarkdown(datos, cuerpo)`, `api/panel/contenido/[id].ts:23`),
con el nombre del slug actual. Quien baja antes de editar trae lo corregido en
el panel.

El riesgo es subir una copia vieja guardada en el equipo, que revertiría la
corrección. Dos defensas:

- **El aviso de la subida dice qué campos cambiaron** respecto a lo que había:
  «Se actualizó «X». Cambió el título: «antes» → «ahora»». Una reversión
  accidental se ve en el momento.
- Lo pisado queda en `post_revisiones`, como ya pasa hoy en cada guardado.

## Decisión 2: la URL vieja redirige con 301

Cambiar la URL deja una **redirección permanente** de la vieja a la nueva. Quien
tenía el enlace llega al artículo, y Google traslada lo ganado por la URL vieja.

### La tabla

Migración nueva `0004_redirecciones.sql`:

```sql
CREATE TABLE post_redirecciones (
  desde     TEXT PRIMARY KEY,   -- slug viejo
  hacia     TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  creado_en TEXT NOT NULL
);
```

`ON DELETE CASCADE`: si se borra el artículo, sus redirecciones se van con él y
la URL vieja pasa a dar 404, igual que la nueva.

### Reglas

- **Sin cadenas.** Al cambiar B → C, toda redirección que apuntaba a B pasa a
  apuntar a C. Nunca se sirve A → B → C: cada salto extra es una petición más y
  Google deja de seguir cadenas largas.
- **Volver a una URL anterior** (A → B y luego B → A) borra la redirección
  `A → B` y crea `B → A`. Una URL nunca es origen de redirección y artículo a la
  vez.
- **La URL nueva no puede estar ocupada**: ni por otro artículo ni por una
  redirección que apunte a otro artículo. Se rechaza con el nombre de quién la
  ocupa.
- **Subir un archivo cuyo nombre es origen de una redirección se rechaza**:
  «Esa URL ahora redirige a «<slug nuevo>». Renombra el archivo a
  <slug nuevo>.md». Sin esto, subir la copia vieja con su nombre original
  crearía un segundo artículo en la URL que debía redirigir, que es justo el
  bug que M-234 quiere quitar.

### Dónde se resuelve

En `/blog/<slug>/`, **solo cuando el artículo no existe**, antes de reescribir a
la 404 (`src/pages/blog/[...slug].astro:22`). La lectura normal no paga la
consulta extra; solo la pagan las URL que de otro modo darían 404.

La redirección apunta a `/blog/<slug nuevo>/` con barra final. Si el destino
está oculto, el destino responde 404, que es lo correcto.

El 301 lleva `Cache-Control: public, max-age=300, s-maxage=60`. Sin `max-age`,
el navegador guarda un 301 indefinidamente, y volver a una URL anterior
(A → B → A) dejaría en bucle a quien visitó A en medio. Con cinco minutos, el
peor caso se cura solo.

Si la consulta falla (por ejemplo, porque la migración no se aplicó antes del
deploy), la página responde 404 y registra el error, en vez de dar 500 en cada
URL inexistente del blog.

### El cambio de clave primaria

`post_revisiones.post_id` apunta a `posts.id` **sin `ON UPDATE CASCADE`**
(`migrations/0002_contenido.sql:47`), así que un `UPDATE posts SET id = …`
falla por la llave foránea. El cambio de URL va en un solo `batch` de D1, que es
transaccional:

1. `INSERT` de la fila con el id nuevo, copiando todo de la vieja.
2. `UPDATE post_revisiones SET post_id = <nuevo>` de las revisiones de la vieja.
3. `UPDATE post_redirecciones SET hacia = <nuevo>` (colapsa cadenas).
4. `DELETE` de la redirección cuyo `desde` es el nuevo, si existía.
5. `DELETE` de la fila vieja.
6. `INSERT` de la redirección vieja → nueva.
7. `INSERT` de la revisión con los datos previos, como en `guardarPost`.

## Caché

`/blog/<slug>/` responde `s-maxage=60, stale-while-revalidate=600`. Tras
cambiar la URL, **la vieja puede seguir sirviendo el artículo desde el borde
hasta unos 11 minutos** en vez de redirigir. No se purga: el contenido es el
mismo y el 301 llega solo. Lo mismo aplica al título y la descripción en la URL
pública.

El sitemap del blog (`src/pages/sitemap-blog.xml.ts:31`) sale de `posts.id`, así
que lista la URL nueva sin tocarlo, y las viejas no aparecen.

## Fuera de alcance

- Editar el cuerpo o las imágenes desde el panel.
- Tocar `updatedDate` al editar. Corregir una errata del título no es una
  actualización del contenido; si hace falta, va por archivo.
- Una pantalla para ver o borrar redirecciones a mano.
- Purgar la caché del borde.

## Criterios de aceptación

Verificados en `astro dev` con la D1 local.

1. En `/panel/contenido/` cada artículo tiene «Editar», después de «Ver», con
   `aria-label` que nombra el artículo.
2. Cambiar el título a 71 caracteres, o la descripción a 69 o 161, vuelve al
   formulario con el mismo mensaje que da la subida y lo escrito conservado.
3. Cambiar título y descripción de un artículo publicado: se ven en
   `/blog/<slug>/` y en `/blog/`, y en `post_revisiones` queda la versión previa.
4. Cambiar la URL de `a` a `b`: `/blog/b/` muestra el artículo, `/blog/a/`
   responde 301 a `/blog/b/`, y en `posts` hay **una** fila, no dos.
5. Las revisiones que tenía `a` aparecen ahora bajo `b`.
6. Cambiar después `b` a `c`: `/blog/a/` responde 301 **directo** a `/blog/c/`.
7. Cambiar `c` de vuelta a `a`: `/blog/a/` muestra el artículo y `/blog/c/`
   redirige a `/blog/a/`; no queda ninguna redirección con origen `a`.
8. Cambiar la URL a la de otro artículo existente se rechaza y no toca nada.
9. Subir `a.md` mientras `a` redirige a otro artículo se rechaza con el mensaje
   que nombra el slug nuevo.
10. Subir un `.md` que cambia el título de un artículo existente: el aviso dice
    qué cambió, con el valor anterior y el nuevo.
11. Borrar un artículo con redirecciones: las URL viejas dan 404.
12. `pnpm check && pnpm test` en verde, con tests de Vitest para la lógica pura:
    validación compartida, colapso de cadenas y el texto del aviso de cambios.

## Cambios que implica

- `migrations/0004_redirecciones.sql`: tabla nueva.
- `src/lib/`: `esquemaSlug` se mueve aquí; funciones nuevas para renombrar
  (`batch` de arriba), editar título y descripción, y buscar la redirección de
  un slug.
- `src/pages/panel/contenido/[slug]/editar.astro` o equivalente: la pantalla.
  Mover `[slug].astro` a `[slug]/index.astro` si Astro lo pide para anidar.
- `src/pages/api/panel/contenido/[id].ts`: acción nueva `editar`.
- `src/pages/api/panel/contenido/index.ts`: rechazo por slug redirigido y aviso
  con los cambios.
- `src/pages/blog/[...slug].astro`: la consulta de redirección antes de la 404.
- `src/pages/panel/contenido/index.astro`: el botón «Editar».
- Conviene hacer [M-247](https://linear.app/markidev/issue/M-247) antes: esta
  feature añade otra pantalla que redirige con errores y datos conservados.
