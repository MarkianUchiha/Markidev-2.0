# Marca

Archivos fuente de la identidad de MarkiDev. **No los sirve el sitio**: lo que
llega al navegador vive en `public/` y lo genera
`scripts/generar-assets-marca.ps1` desde estas mismas primitivas.

| Archivo                     | Uso                                          |
| --------------------------- | -------------------------------------------- |
| `MarkiDev-isotipo-clara.*`  | el chevron sobre placa morada. Fondos claros |
| `MarkiDev-isotipo-oscura.*` | placa naranja, chevron negro. Fondos oscuros |
| `MarkiDev-lockup-clara.*`   | isotipo + nombre. Fondos claros              |
| `MarkiDev-lockup-oscura.*`  | isotipo + nombre. Fondos oscuros             |

Los SVG son la fuente de verdad; los PNG (1024 px el isotipo, 1860 px el
lockup) salieron de ellos.

## Dos cosas antes de usarlos

**El lockup tiene el nombre en la tipografía equivocada.** El SVG dejó
«MarkiDev» como `<text>` con `font-family="Poppins, Arial, sans-serif"` y
`font-weight="600"`, sin vectorizar. Sin Poppins instalada cae a Arial, y así
se rasterizaron el PNG y el PDF. Antes de mandar el lockup a imprenta o a una
red social hay que vectorizar ese texto en Poppins.

Es también la razón de que la imagen de previa no se componga a partir del
lockup: se dibuja desde cero para poder usar Poppins 700 de verdad.

**El isotipo va a sangre en iOS.** Apple pinta de negro lo que sea transparente
y encima aplica su propia máscara redondeada, así que `apple-touch-icon.png` no
lleva ni alfa ni esquinas redondeadas propias.

## Regenerar lo que sirve el sitio

```
pwsh -File scripts/generar-assets-marca.ps1
```

Escribe `public/apple-touch-icon.png`, `public/favicon-32.png` y
`public/og-markidev.png`. `public/favicon.svg` se mantiene a mano: lleva dentro
una consulta de `prefers-color-scheme` y por eso no se genera.
