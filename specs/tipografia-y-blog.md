# Tipografía más ligera y entradas del blog pulsables

Estado: **aprobada** el 2026-09-21.
Issues: [M-216](https://linear.app/markidev/issue/M-216) (tipografía) y
[M-215](https://linear.app/markidev/issue/M-215) (entradas del blog).
Dirección elegida el 2026-09-21 entre cinco alternativas comparadas en pantalla:
**B, mismas familias con otra escala**, y la **tarjeta con borde y llamada**.

## Por qué

- El sitio se lee «cuadrado y conservador». Poppins 700 en bloque apretado pesa
  demasiado en titulares grandes, y el cuerpo a 15px queda chico para un
  artículo largo.
- Los títulos de `/blog/`, del artículo y de `/trabajos/` **no usan Poppins**:
  llevan `font-semibold` sin `font-display` y salen en Open Sans 600, contra lo
  que declara `DESIGN.local.md` (h1–h3 van en Poppins).
  - `src/pages/blog/index.astro:28` y `:41`
  - `src/pages/blog/[...slug].astro:47`
  - `src/pages/trabajos/index.astro:15`
  - `src/pages/trabajos/[...slug].astro:32`
- En el índice del blog solo es pulsable el renglón del título, y en un teléfono
  nada indica que lleva a algún lado.

## Qué cambia

### Titulares (M-216)

| Rol             | Hoy                   | Nuevo                                |
| --------------- | --------------------- | ------------------------------------ |
| Peso de titular | Poppins 700           | **Poppins 600**                      |
| hero            | 52px · 1.05 · -0.02em | **40→60px** fluido · 1.08 · -0.035em |
| section         | 34px · 1.15 · -0.01em | **38px** · 1.1 · -0.025em            |
| body            | 15px · 1.6            | **16px** · 1.65                      |

- El peso de titular deja de escribirse como `font-bold` en cada plantilla: pasa
  a un token `--font-weight-titular: 600`, que genera la utilidad
  `font-titular`. Así, cambiar el peso otra vez toca una línea.
- **El hero se vuelve fluido**: `clamp(40px, 29.74px + 2.564vw, 60px)`, o sea
  40px a 400px de ancho y 60px a 1180px, igual que ya hace `--text-quote`. A 60px
  fijos, «Digitalizo» no cabe en un teléfono de 390px.
- **El logotipo sigue en Poppins 700.** Es la marca, no un titular, y no cambia
  por un ajuste de escala. Entra en esa categoría el nombre de `Nav.astro`,
  `Pie.astro` y `Panel.astro`. El resto de los usos de `font-display font-bold`
  pasa a `font-titular`, incluidos el menú a pantalla completa y los números del
  proceso.
- Se cargan Poppins **600 y 700**, subconjunto `latin`. Es un archivo más, del
  orden de 8 KB.
- Los cinco títulos de la lista de arriba pasan a Poppins, con `font-display`
  y `font-titular`.
- Open Sans y Crimson Pro siguen en su mismo papel y con los mismos pesos.

### Entradas del blog (M-215)

Cada entrada del índice es una tarjeta:

- Fondo `surface`, borde de 1px `border` (naranja), radio de 14px y padding
  de 32px.
- Título en Poppins 600, 30px; descripción en `text-ink-subtle`; abajo, la fecha
  a la izquierda y **«Leer artículo →»** a la derecha, en `text-brand` y peso 600.
- **Toda la tarjeta es pulsable** y hay **un solo enlace**: el del título, que se
  extiende a la tarjeta completa con un `::after` absoluto. La llamada «Leer
  artículo» va con `aria-hidden`, porque repetiría el destino para un lector de
  pantalla.
- **Foco visible en la tarjeta entera** cuando el enlace tiene foco por teclado.
- Al pasar el cursor, la flecha se desplaza 4px a la derecha, solo con
  `motion-safe`.

## Qué no cambia

- La paleta, los tokens de color y el contraste medido.
- Las familias: no entra ninguna fuente nueva.
- La lista de trabajos (`/trabajos/`) conserva su maqueta; solo corrige la
  fuente del título.

## Criterios de aceptación

1. En la portada, en un teléfono de 390px, el `h1` cabe sin cortar palabras y
   mide 40px. En 1280px mide 60px.
2. Ningún titular (h1–h3, números del proceso, menú) se sirve en peso 700,
   salvo el logotipo.
3. Los títulos de blog, artículo y trabajos se sirven en Poppins.
4. En el índice del blog, un toque en cualquier punto de la tarjeta abre el
   artículo. Con Tab, cada entrada recibe un solo foco y el contorno se ve en la
   tarjeta.
5. «Leer artículo» cumple AA sobre `surface` en los dos modos: `#5c3888` sobre
   blanco y `#9b72d0` sobre `#1a1a1d` (4.7:1, calculado).
6. `DESIGN.local.md` registra la escala nueva, el token `font-titular` y la
   excepción del logotipo.
7. `pnpm check` pasa.

## Verificación

El cambio es de presentación, sin lógica que probar con tests unitarios. Se
verifica con `pnpm check` y revisando en el navegador la portada, `/sobre-mi/`,
`/blog/`, un artículo, `/trabajos/` y la 404 a 390px y a 1280px, en los dos
modos.
