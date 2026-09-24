# Constitución de MarkiDev 2.0

Las reglas que valen para cualquier cambio, sea cual sea la feature. Lo que
hace el producto está en `SPEC.md`; por qué se decidió cada cosa, en
`Decisiones.md`. Cambiar una regla de aquí es una decisión: se anota en
`Decisiones.md` en el mismo cambio que la modifica.

Nivel SDD del proyecto: **Medio**. Datos personales de prospectos, un solo
operador, sin pagos. Se reevalúa si entra un pago, si el panel se abre a otra
persona o si aparece un cliente que apruebe alcance.

## Stack

| Pieza              | Versión                            | Nota                                                    |
| ------------------ | ---------------------------------- | ------------------------------------------------------- |
| Astro              | 7                                  | Con `@astrojs/cloudflare` 14; `trailingSlash: "always"` |
| Cloudflare Workers | fecha de compatibilidad 2026-09-03 | Solo `global_fetch_strictly_public`                     |
| Cloudflare D1      | —                                  | Binding `DB`; migraciones en `migrations/`              |
| Cloudflare Access  | —                                  | Delante de todo el panel                                |
| Tailwind CSS       | 4                                  | Tokens en `src/styles/global.css`                       |
| React              | 19                                 | Solo donde hay interactividad real (el tablero)         |
| TypeScript         | 6                                  |                                                         |
| Vitest             | 5                                  | Pruebas de `src/lib`                                    |
| pnpm               | 10                                 | Gestor de paquetes                                      |
| Node               | 24                                 | Solo para herramientas; el sitio no corre en Node       |

## El Worker

1. **Nada de APIs de Node ni de WebAssembly** en lo que corre en el Worker.
   `nodejs_compat` está apagado a propósito ([Decisiones 003](Decisiones.md#003)).
   Una librería que dependa de `Buffer`, `fs` o Wasm no sirve.
2. **El binding de D1 se lee dentro de cada función**, nunca al cargar el
   módulo: fuera de una petición no existe.
3. **Nada asíncrono en el ámbito global.** Lo que cuesta armar (el procesador de
   markdown, el resaltador) se arma en la primera petición y se reutiliza.
4. **Las peticiones a URLs de terceros llevan tope de tiempo y de bytes**, y un
   fallo nunca tumba la operación que las pidió.

## Datos

1. **Una migración aplicada no se edita.** Un cambio de esquema es una
   migración nueva y numerada.
2. **Las reglas duras viven también en la base**, con `CHECK`, no solo en el
   código: no se puede descartar un prospecto sin motivo aunque falle la
   validación de arriba.
3. **Guardar antes de avisar.** Cuando una acción guarda y notifica, primero
   guarda. Un aviso que falla no puede perder el dato.
4. **Toda reescritura de un artículo deja la versión anterior** en
   `post_revisiones`.
5. **Datos personales:** solo se guarda lo que declara el aviso de privacidad.
   Guardar un campo nuevo de una persona exige actualizar primero el aviso.

## Seguridad

1. **Todo `/panel/` y `/api/panel/` va detrás de Cloudflare Access, y cada ruta
   comprueba además `Astro.locals.usuario`.** Una ruta nueva del panel sin esa
   comprobación no se commitea.
2. **`set:html` solo en dos sitios, cada uno con su defensa.** El cuerpo de un
   artículo, en `src/components/ArticuloBlog.astro`, entra ya saneado por
   `rehype-sanitize`. El JSON-LD, en `src/layouts/Layout.astro`, lleva texto de
   los artículos y lo protege el escape de `<` en `grafo()` (`src/lib/schema.ts`).
   Ninguna de las dos defensas se quita.
3. **Ningún secreto en el repositorio ni en la línea de comandos.** Van en
   `.dev.vars` (ignorado) o en los secretos del Worker. Lo que necesita una
   credencial va por un script de `scripts/` que la lee en tiempo de ejecución.
4. **Una cabecera HTTP solo lleva ASCII.** Un texto con tildes en una
   redirección va codificado: se usa `redirigir()` de `src/lib/redireccion.ts`
   o su equivalente, nunca una consulta escrita a mano.

## Convenciones

1. **Identificadores del DOM, del CSS y funciones de `src/lib` en español**
   (`#abrir-menu`, `.tema-oscuro`, `redirigir`).
2. **Toda URL interna lleva barra final**, incluidas las de `fetch` y `action`.
3. **Los colores se usan por su token semántico**, nunca un hex en una
   plantilla. Un valor de diseño que no esté en la guía de diseño del proyecto
   no se inventa: se pide y se anota allí.
4. **Formularios nativos**, sin isla, con `POST` y respuesta `303`. Tras un
   error se vuelve a la pantalla con lo escrito conservado.
5. **Los mensajes que ve una persona van en español** y dicen qué falló y cómo
   arreglarlo. Un texto de una librería no llega a la pantalla tal cual.
6. **Los comentarios explican el porqué**, no repiten lo que dice el código.
7. **Commits en español**, con la forma `tipo(scope): descripción` (`feat`,
   `fix`, `refactor`, `docs`, `test`, `chore`, `style`), y una cosa por commit.

## Páginas públicas

1. **Un solo `<h1>` por página**, jerarquía sin saltos.
2. **Todo el contenido indexable se renderiza en el servidor.** Lo que solo
   aparece tras ejecutar JavaScript no existe para los buscadores.
3. **El JSON-LD describe solo lo que está visible.**
4. **Imágenes con `width`, `height` y `alt` reales.**
5. **Accesibilidad:** área táctil de al menos 44 px, foco visible, y ningún
   significado transmitido solo por color. `[SIN VERIFICAR]` que todo lo
   público ya cumpla los 44 px. El panel **no** los cumple hoy: medido el
   2026-09-23 en `/panel/contenido/`, los botones miden 35 px y el desplegable
   «Borrar», 21 px (M-261).

## Cómo se trabaja

1. **Spec antes de código.** Una feature nueva empieza con su spec en `specs/`,
   aprobada por el dueño; luego plan, tareas en Linear y, dentro de cada tarea,
   TDD. Si un cambio contradice una spec, la spec se actualiza en el mismo
   cambio.
2. **Nada está terminado sin verificar.** El único comando que cierra una tarea
   es `pnpm check && pnpm test`, con su salida real. Lo que toca D1 se prueba
   además en `astro dev`, y lo que se ve, en el navegador.
3. **Las funciones puras de `src/lib` se prueban con Vitest, test primero.** Un
   test con datos armados a mano se coteja, cuando se pueda, con una fuente
   independiente.
4. **Antes de desplegar un cambio grande**, una revisión del rango sin publicar
   hecha con ojos que no lo escribieron.
5. **Despliegue** ([Decisiones 007](Decisiones.md#007)), una vez por tanda de
   trabajo y en este orden: `whoami`, el check, las migraciones remotas y el
   deploy.

## Prohibido

- APIs de Node, WebAssembly o `nodejs_compat` en el Worker.
- Editar una migración ya aplicada.
- Un secreto en el repositorio, en un commit, en un log o en la línea de
  comandos.
- Una ruta del panel sin comprobar al usuario.
- `set:html` fuera de `ArticuloBlog.astro` y del JSON-LD de `Layout.astro`.
- Un color, tamaño o espaciado escrito a mano en una plantilla.
- Guardar datos personales que el aviso de privacidad no declara.
- Desplegar sin `pnpm check && pnpm test` en verde.
