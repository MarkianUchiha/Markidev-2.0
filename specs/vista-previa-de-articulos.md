# Vista previa de artículos del blog

Estado: **aprobada** el 2026-09-22.
Issue: [M-233](https://linear.app/markidev/issue/M-233).

## Qué es

Una pantalla del panel que enseña un artículo **tal como se verá publicado**,
aunque esté oculto. Sirve para confirmar con los ojos que la conversión salió
bien antes de publicar: los encabezados, las tablas, el código resaltado y sobre
todo **las imágenes puestas por URL**, que hoy no se pueden comprobar sin dejar
el artículo visible para cualquiera.

**Qué no es:** un editor. No se corrige nada desde aquí. Cambiar el título, la
descripción o la dirección es [M-234](https://linear.app/markidev/issue/M-234),
y va aparte.

## Por qué hace falta

Hoy el único modo de ver un artículo es publicarlo. Si algo salió mal, estuvo a
la vista mientras duró la revisión. El paso de revisión se hace en producción y
en público, que es exactamente lo que no debe pasar.

## La dirección: `/panel/contenido/<slug>/`

Va **dentro del panel**, detrás de Cloudflare Access, y no en la ruta pública
del artículo con algún parámetro.

El motivo es concreto: `/blog/<slug>/` responde con
`Cache-Control: public, s-maxage=60, stale-while-revalidate=600`
(`src/pages/blog/[...slug].astro:24`). Si esa ruta sirviera el borrador a quien
tiene sesión, **el borde guardaría esa respuesta y se la daría a cualquiera**
durante el minuto siguiente. Un error de una cabecera publicaría el borrador.
Separando la ruta, ese riesgo no existe.

Esta pantalla responde `Cache-Control: private, no-store`: no se guarda en el
borde ni en el navegador.

## Qué enseña

El artículo **con la misma plantilla que el sitio público**: el mismo layout con
su menú y su pie, el mismo ancho de lectura, los mismos estilos de prosa. Si la
previa usara una plantilla propia dejaría de servir para lo que existe — se
vería distinta de lo que se va a publicar.

Para que no puedan divergir, el cuerpo del artículo sale de **un solo componente
compartido** entre la ruta pública y esta. Hoy ese markup vive dentro de
`src/pages/blog/[...slug].astro:45-73` y hay que extraerlo.

Debajo del artículo, una franja pegada al borde inferior (`sticky`) que diga que es una vista previa y en qué
estado está el artículo (oculto o publicado), con la salida de vuelta al panel.
Sin eso, la pantalla es indistinguible del sitio real y se presta a creer que ya
está publicado.

## Qué ya existe y no hay que construir

- `obtenerPost(id, { soloPublicado: false })` (`src/lib/db.ts:254`) ya sabe traer
  un artículo oculto. El interruptor está puesto y sin usar.
- El HTML ya está convertido y saneado en la columna `html` de `posts`: se
  procesa al guardar, no al servir. No hay que convertir nada aquí.

## Decisiones

| Tema                 | Decisión                                        | Por qué                                                                                                               |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Dirección            | `/panel/contenido/<slug>/`                      | Access ya la protege y no hereda la caché de borde de la ruta pública                                                 |
| Plantilla            | La misma del sitio, en un componente compartido | Una previa que se ve distinta no confirma nada                                                                        |
| Caché                | `private, no-store`                             | Un borrador no puede quedar guardado en ningún intermediario                                                          |
| Editar desde aquí    | Fuera de alcance                                | Es M-234                                                                                                              |
| Artículos publicados | También se pueden previsualizar                 | Misma pantalla para los dos estados; simplifica y sirve para revisar una edición antes de que expire la caché pública |

## Sobre las imágenes

El saneado usa el `defaultSchema` de `rehype-sanitize` (`src/lib/frontmatter.ts:130`),
que **sí deja pasar `<img>`** con `src` en `http` y `https`. Una imagen por URL
debe aparecer, y esta pantalla es donde se comprueba.

Lo que ese esquema **no** deja pasar es `width` ni `height`. La imagen llega sin
dimensiones declaradas, así que el texto salta cuando termina de cargar. No se
resuelve en esta spec, pero se va a ver al usar la pantalla: si molesta, sale
como issue aparte.

## Criterios de aceptación

1. Desde `/panel/contenido/` se llega a la vista previa de cualquier artículo,
   esté oculto o publicado.
2. Un artículo oculto se ve completo, con los mismos estilos que tendría
   publicado, sin haberlo publicado en ningún momento.
3. Las imágenes puestas por URL en el markdown aparecen en la vista previa.
4. Sin la sesión de Access, la vista previa no responde.
5. La respuesta lleva `Cache-Control: private, no-store`.
6. `/blog/<slug>/` sigue respondiendo 404 para un artículo oculto, sin cambios.
7. El artículo publicado se sigue viendo igual que antes de extraer el
   componente: mismo HTML de salida.
8. `pnpm check` pasa y los tests también.

## Cambios que implica

- Extraer el cuerpo del artículo de `src/pages/blog/[...slug].astro` a un
  componente compartido.
- `src/pages/panel/contenido/[slug].astro`, la pantalla nueva.
- Un enlace por fila en la lista de `/panel/contenido/index.astro`.
- Nada de esto toca la base ni la API.
