# Marca

Archivos de la identidad de MarkiDev. **No los sirve el sitio**: lo que llega
al navegador vive en `public/`.

| Archivo                     | Uso                                          | Origen   |
| --------------------------- | -------------------------------------------- | -------- |
| `MarkiDev-isotipo-clara.*`  | el chevron sobre placa morada. Fondos claros | a mano   |
| `MarkiDev-isotipo-oscura.*` | placa naranja, chevron negro. Fondos oscuros | a mano   |
| `MarkiDev-lockup-clara.*`   | isotipo + nombre. Fondos claros              | generado |
| `MarkiDev-lockup-oscura.*`  | isotipo + nombre. Fondos oscuros             | generado |

El isotipo SVG es la fuente de verdad de toda la marca. Todo lo demás sale de
`scripts/generar-assets-marca.ps1`:

```
pwsh -File scripts/generar-assets-marca.ps1
```

Escribe los cuatro archivos del lockup y, en `public/`, el icono de iOS, el
respaldo del favicon y la imagen de previa. `public/favicon.svg` también se
mantiene a mano: lleva dentro una consulta de `prefers-color-scheme`.

## Tres cosas antes de usarlos

**El nombre del lockup son contornos, no texto.** Se ve igual en cualquier
parte y no depende de que haya una fuente instalada. El que entregó el
proveedor traía «MarkiDev» como `<text>` con
`font-family="Poppins, Arial, sans-serif"` sin vectorizar, así que sin Poppins
caía a Arial — y así se rasterizaron su PNG y su PDF. Los contornos de ahora
coinciden con Poppins 700 real dentro del redondeo del archivo (0.06 unidades
sobre 348 de ancho, verificado contra `opentype.js`).

**Van en Poppins 700, no en el 600 del original.** El sitio carga una sola cara
de Poppins y es la 700; con el lockup en 600 la marca tendría dos pesos según
dónde se mire. Si algún día se quiere el 600, se cambia `$PesoNombre` en el
script y se vuelve a correr.

**Los PDF de la entrega original quedaron obsoletos.** Nunca entraron al
repositorio y siguen con el nombre en Arial. Si hacen falta, se exportan desde
estos SVG.

## Dónde NO va el lockup

Dentro del sitio, en ningún lado. Ahí va el isotipo y el nombre se escribe como
HTML con Poppins 700. El lockup es para redes, documentos y la imagen de
previa.

Y el isotipo va a sangre en iOS: Apple pinta de negro lo que sea transparente y
encima aplica su propia máscara redondeada, así que `apple-touch-icon.png` no
lleva ni alfa ni esquinas redondeadas propias.
