<#
  Genera todo lo que se deriva del isotipo:

    brand/MarkiDev-lockup-*.svg   isotipo + el nombre en contornos
    brand/MarkiDev-lockup-*.png   los mismos, a 1860x600
    public/apple-touch-icon.png   icono de iOS
    public/favicon-32.png         respaldo del favicon
    public/og-markidev.png        previa para WhatsApp y redes

  Se corre a mano, no en el build. Cambian solo si cambia la marca:

      pwsh -File scripts/generar-assets-marca.ps1

  Lo unico que NO sale de aqui: brand/MarkiDev-isotipo-*.svg, que es la fuente
  de verdad y esta escrito a mano, y public/favicon.svg, que lleva dentro una
  consulta de `prefers-color-scheme`.

  POR QUE POWERSHELL Y NO UN .mjs COMO EL RESTO DE scripts/
  El proyecto no tiene `sharp` —el adapter de Cloudflare no lo arrastra— y
  vectorizar texto ademas pedia `opentype.js`. Dos dependencias para archivos
  que se generan una vez no se pagan. System.Drawing ya viene con Windows y
  hace las dos cosas: rasteriza y saca contornos de una fuente.

  POR QUE EL LOCKUP SE GENERA Y YA NO SE EDITA A MANO
  El que entrego el proveedor traia el nombre como <text> sin vectorizar, con
  `font-family="Poppins, Arial, sans-serif"`. Sin Poppins instalada cae a Arial,
  y asi se rasterizaron su PNG y su PDF. Ahora el nombre son contornos: se ve
  igual en todas partes y no depende de que haya una fuente instalada.

  POR QUE 700 Y NO EL 600 DEL ORIGINAL
  El sitio carga una sola cara de Poppins, la 700. Con el lockup en 600 la marca
  tendria dos pesos segun donde se mire. Si alguna vez se quiere el 600, se
  cambia $PesoNombre aqui y se vuelve a correr.

  POR QUE SE DIBUJA Y NO SE REESCALA UN PNG GRANDE
  A 32 px un reescalado de 1024 llega sucio. Dibujando las primitivas cada
  tamano sale nitido. Ademas el icono de iOS no puede llevar transparencia ni
  esquinas redondeadas propias: iOS pone negro donde hay alfa y encima aplica
  su mascara. Por eso ese va a sangre y sin redondear, y los otros no.

  El isotipo en coordenadas originales (viewBox 0 0 200 200):
    placa    rect x=10 y=10 w=180 h=180 rx=40
    chevron  M80,58 L128,100 L80,142, grosor 18, puntas y codo redondos
    punto    circulo cx=152 cy=52 r=14
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$publico = Join-Path $raiz 'public'
$marca = Join-Path $raiz 'brand'

$PesoNombre = [System.Drawing.FontStyle]::Bold

# Paleta. Los mismos hex que src/styles/global.css; aqui se repiten porque GDI+
# no lee CSS, no porque haya dos fuentes de verdad.
$purpura = [System.Drawing.ColorTranslator]::FromHtml('#684198')
$naranja = [System.Drawing.ColorTranslator]::FromHtml('#FF9900')
$verde   = [System.Drawing.ColorTranslator]::FromHtml('#85FF00')
$negro   = [System.Drawing.ColorTranslator]::FromHtml('#121212')
$hueso   = [System.Drawing.ColorTranslator]::FromHtml('#FAFAF9')
# El nombre en la version clara: purpura casi negro, como venia en el original.
$tinta   = [System.Drawing.ColorTranslator]::FromHtml('#2A1F3D')

# ---------------------------------------------------------------------------
# Fuente
# ---------------------------------------------------------------------------
# GDI+ no lee woff2, que es lo unico que Astro cachea en .astro/fonts/. Se baja
# el .ttf de Google Fonts (OFL) al temporal; no entra al repositorio.
$ttf = Join-Path ([System.IO.Path]::GetTempPath()) 'Poppins-Bold.ttf'
if (-not (Test-Path $ttf)) {
    Write-Output '  descargando Poppins 700 (OFL) ...'
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf' -OutFile $ttf
}
$fuentes = [System.Drawing.Text.PrivateFontCollection]::new()
$fuentes.AddFontFile($ttf)
$familia = $fuentes.Families[0]

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

function New-Lienzo {
    param([int]$Ancho, [int]$Alto)

    $bmp = [System.Drawing.Bitmap]::new($Ancho, $Alto, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    [PSCustomObject]@{ Bitmap = $bmp; Graficos = $g }
}

function New-RectanguloRedondo {
    param([single]$X, [single]$Y, [single]$Ancho, [single]$Alto, [single]$Radio)

    $d = $Radio * 2
    $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $p.AddArc($X, $Y, $d, $d, 180, 90)
    $p.AddArc($X + $Ancho - $d, $Y, $d, $d, 270, 90)
    $p.AddArc($X + $Ancho - $d, $Y + $Alto - $d, $d, $d, 0, 90)
    $p.AddArc($X, $Y + $Alto - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    $p
}

<#
  Dibuja el chevron y el punto. `Escala` convierte las unidades del viewBox a
  pixeles; `DesplazaX`/`DesplazaY` mueven el origen.
#>
function Add-ChevronYPunto {
    param(
        [System.Drawing.Graphics]$G,
        [single]$Escala,
        [single]$DesplazaX,
        [single]$DesplazaY,
        [System.Drawing.Color]$ColorTrazo,
        [System.Drawing.Color]$ColorPunto
    )

    $x = { param($v) $DesplazaX + $v * $Escala }
    $y = { param($v) $DesplazaY + $v * $Escala }

    $pluma = [System.Drawing.Pen]::new($ColorTrazo, 18 * $Escala)
    $pluma.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pluma.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pluma.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $trazo = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $trazo.AddLine((& $x 80), (& $y 58), (& $x 128), (& $y 100))
    $trazo.AddLine((& $x 128), (& $y 100), (& $x 80), (& $y 142))
    $G.DrawPath($pluma, $trazo)

    $r = 14 * $Escala
    $brocha = [System.Drawing.SolidBrush]::new($ColorPunto)
    $G.FillEllipse($brocha, (& $x 152) - $r, (& $y 52) - $r, $r * 2, $r * 2)

    $brocha.Dispose(); $trazo.Dispose(); $pluma.Dispose()
}

<#
  Contornos del texto, con la linea base en Y y empezando en X.

  Se generan a 10x y se reducen al final: a tamano real GDI+ ajusta los
  contornos a la rejilla de pixeles y el resultado saldria deformado.
#>
function New-RutaTexto {
    param([string]$Texto, [single]$Tamano, [single]$X, [single]$LineaBase)

    $factor = 10
    $em = $Tamano * $factor

    # AddString coloca el ALTO de la linea en el origen, no la linea base.
    $ascenso = $em * $familia.GetCellAscent($PesoNombre) / $familia.GetEmHeight($PesoNombre)

    $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $p.AddString(
        $Texto, $familia, [int]$PesoNombre, $em,
        [System.Drawing.PointF]::new(($X * $factor), ($LineaBase * $factor - $ascenso)),
        [System.Drawing.StringFormat]::GenericTypographic
    )

    $encoger = [System.Drawing.Drawing2D.Matrix]::new()
    $encoger.Scale((1 / $factor), (1 / $factor))
    $p.Transform($encoger)
    $encoger.Dispose()
    $p
}

<#
  GraphicsPath -> el atributo `d` de un <path>.

  GDI+ marca cada punto con un tipo: 0 arranca una figura, 1 es recta, 3 es
  bezier cubica y viene de tres en tres. El bit 0x80 cierra la figura.
#>
function ConvertTo-RutaSvg {
    param([System.Drawing.Drawing2D.GraphicsPath]$Ruta)

    $puntos = $Ruta.PathPoints
    $tipos = $Ruta.PathTypes
    $n = [System.Text.StringBuilder]::new()
    $num = { param($v) [math]::Round($v, 2).ToString([cultura]::InvariantCulture) }

    $i = 0
    while ($i -lt $puntos.Length) {
        $tipo = $tipos[$i] -band 0x07
        switch ($tipo) {
            0 { [void]$n.Append('M' + (& $num $puntos[$i].X) + ' ' + (& $num $puntos[$i].Y)); $paso = 1 }
            1 { [void]$n.Append('L' + (& $num $puntos[$i].X) + ' ' + (& $num $puntos[$i].Y)); $paso = 1 }
            3 {
                [void]$n.Append('C' +
                    (& $num $puntos[$i].X) + ' ' + (& $num $puntos[$i].Y) + ' ' +
                    (& $num $puntos[$i + 1].X) + ' ' + (& $num $puntos[$i + 1].Y) + ' ' +
                    (& $num $puntos[$i + 2].X) + ' ' + (& $num $puntos[$i + 2].Y))
                $paso = 3
            }
            default { throw "Tipo de punto inesperado: $($tipos[$i])" }
        }
        if ($tipos[$i + $paso - 1] -band 0x80) { [void]$n.Append('Z') }
        $i += $paso
    }
    $n.ToString()
}

function Save-Png {
    param([System.Drawing.Bitmap]$Bitmap, [string]$Ruta)

    $Bitmap.Save($Ruta, [System.Drawing.Imaging.ImageFormat]::Png)
    $kb = [math]::Round((Get-Item $Ruta).Length / 1KB, 1)
    Write-Output ("  {0,-30} {1,4}x{2,-4} {3,6} KB" -f (Split-Path -Leaf $Ruta), $Bitmap.Width, $Bitmap.Height, $kb)
}

# `[cultura]` existe solo para que el redondeo no escriba comas decimales: en
# un SVG "12,5" se lee como dos numeros.
Add-Type -TypeDefinition 'public class cultura { public static System.Globalization.CultureInfo InvariantCulture { get { return System.Globalization.CultureInfo.InvariantCulture; } } }'

Write-Output 'Generando assets de marca:'

# ---------------------------------------------------------------------------
# Lockup: isotipo + el nombre en contornos
# ---------------------------------------------------------------------------
# Se conservan las coordenadas del original: el isotipo corrido 10 a la derecha,
# el nombre a 72 con la linea base en 128. Lo unico que cambia es el ancho del
# viewBox, que ahora se ajusta al texto real en vez de quedar fijo en 620.
$tamanoNombre = 72
$nombreX = 230
$nombreBase = 128

$rutaNombre = New-RutaTexto -Texto 'MarkiDev' -Tamano $tamanoNombre -X $nombreX -LineaBase $nombreBase
$d = ConvertTo-RutaSvg -Ruta $rutaNombre
$anchoNombre = $rutaNombre.GetBounds().Right - $nombreX
$rutaNombre.Dispose()

# 10 de margen a la derecha, el mismo que el isotipo tiene a la izquierda.
$anchoCaja = [math]::Ceiling($nombreX + $anchoNombre + 10)

foreach ($v in @(
    @{ Nombre = 'clara';  Placa = '#684198'; Trazo = '#FAFAF9'; Punto = '#FF9900'; Texto = '#2A1F3D' },
    @{ Nombre = 'oscura'; Placa = '#FF9900'; Trazo = '#121212'; Punto = '#85FF00'; Texto = '#FAFAF9' }
)) {
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="$($anchoCaja * 3)" height="600" viewBox="0 0 $anchoCaja 200"><g transform="translate(10,0)">
<rect x="10" y="10" width="180" height="180" rx="40" fill="$($v.Placa)"></rect>
<path d="M80,58 L128,100 L80,142" fill="none" stroke="$($v.Trazo)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"></path>
<circle cx="152" cy="52" r="14" fill="$($v.Punto)"></circle>
</g>
<path d="$d" fill="$($v.Texto)"></path>
</svg>
"@
    $destino = Join-Path $marca "MarkiDev-lockup-$($v.Nombre).svg"
    [System.IO.File]::WriteAllText($destino, $svg, [System.Text.UTF8Encoding]::new($false))
    $kb = [math]::Round((Get-Item $destino).Length / 1KB, 1)
    Write-Output ("  {0,-30} {1,17} KB" -f (Split-Path -Leaf $destino), $kb)

    # El PNG a 1860x600 como el original: escala 3 sobre el viewBox.
    $e = 3
    $l = New-Lienzo -Ancho ($anchoCaja * $e) -Alto 600
    $placa = New-RectanguloRedondo -X (20 * $e) -Y (10 * $e) -Ancho (180 * $e) -Alto (180 * $e) -Radio (40 * $e)
    $brocha = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($v.Placa))
    $l.Graficos.FillPath($brocha, $placa)
    $brocha.Dispose(); $placa.Dispose()
    Add-ChevronYPunto -G $l.Graficos -Escala $e -DesplazaX (10 * $e) -DesplazaY 0 `
        -ColorTrazo ([System.Drawing.ColorTranslator]::FromHtml($v.Trazo)) `
        -ColorPunto ([System.Drawing.ColorTranslator]::FromHtml($v.Punto))

    $texto = New-RutaTexto -Texto 'MarkiDev' -Tamano ($tamanoNombre * $e) -X ($nombreX * $e) -LineaBase ($nombreBase * $e)
    $brocha = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($v.Texto))
    $l.Graficos.FillPath($brocha, $texto)
    $brocha.Dispose(); $texto.Dispose()

    Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $marca "MarkiDev-lockup-$($v.Nombre).png")
    $l.Graficos.Dispose(); $l.Bitmap.Dispose()
}

# ---------------------------------------------------------------------------
# Icono de iOS: 180x180, a sangre, sin alfa
# ---------------------------------------------------------------------------
# La placa ocupa 180 unidades del viewBox y el destino mide 180 px, asi que la
# escala es 1:1 y solo hay que correr el origen 10 unidades.
$l = New-Lienzo -Ancho 180 -Alto 180
$brocha = [System.Drawing.SolidBrush]::new($purpura)
$l.Graficos.FillRectangle($brocha, 0, 0, 180, 180)
$brocha.Dispose()
Add-ChevronYPunto -G $l.Graficos -Escala 1 -DesplazaX -10 -DesplazaY -10 -ColorTrazo $hueso -ColorPunto $naranja
Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $publico 'apple-touch-icon.png')
$l.Graficos.Dispose(); $l.Bitmap.Dispose()

# ---------------------------------------------------------------------------
# Respaldo del favicon: 32x32, redondeado, con alfa
# ---------------------------------------------------------------------------
$escala = 32 / 180
$l = New-Lienzo -Ancho 32 -Alto 32
$placa = New-RectanguloRedondo -X 0 -Y 0 -Ancho 32 -Alto 32 -Radio (40 * $escala)
$brocha = [System.Drawing.SolidBrush]::new($purpura)
$l.Graficos.FillPath($brocha, $placa)
$brocha.Dispose(); $placa.Dispose()
Add-ChevronYPunto -G $l.Graficos -Escala $escala -DesplazaX (-10 * $escala) -DesplazaY (-10 * $escala) -ColorTrazo $hueso -ColorPunto $naranja
Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $publico 'favicon-32.png')
$l.Graficos.Dispose(); $l.Bitmap.Dispose()

# ---------------------------------------------------------------------------
# Previa para compartir: 1200x630
# ---------------------------------------------------------------------------
# Sobre morado va la variante oscura del isotipo: la placa morada desapareceria
# contra el fondo. Naranja sobre morado da 3.51, que alcanza para una forma
# grande, y el nombre en blanco hueso se lee de sobra.
$l = New-Lienzo -Ancho 1200 -Alto 630
$brocha = [System.Drawing.SolidBrush]::new($purpura)
$l.Graficos.FillRectangle($brocha, 0, 0, 1200, 630)
$brocha.Dispose()

$ladoPlaca = 200
$hueco = 44
$tamanoPrevia = 116

$medir = New-RutaTexto -Texto 'MarkiDev' -Tamano $tamanoPrevia -X 0 -LineaBase 0
$cajaTexto = $medir.GetBounds()
$medir.Dispose()

# El grupo entero se centra, no cada pieza por su lado: si se centraran aparte,
# el aire entre isotipo y nombre cambiaria con el largo del nombre.
$izquierda = (1200 - ($ladoPlaca + $hueco + $cajaTexto.Right)) / 2

$escala = $ladoPlaca / 180
$arriba = (630 - $ladoPlaca) / 2
$placa = New-RectanguloRedondo -X $izquierda -Y $arriba -Ancho $ladoPlaca -Alto $ladoPlaca -Radio (40 * $escala)
$brocha = [System.Drawing.SolidBrush]::new($naranja)
$l.Graficos.FillPath($brocha, $placa)
$brocha.Dispose(); $placa.Dispose()
Add-ChevronYPunto -G $l.Graficos -Escala $escala -DesplazaX ($izquierda - 10 * $escala) -DesplazaY ($arriba - 10 * $escala) -ColorTrazo $negro -ColorPunto $verde

# Se centra por la altura real de las mayusculas —no por la caja de la fuente,
# que trae aire arriba y abajo— para que el nombre quede a la par del isotipo.
$texto = New-RutaTexto -Texto 'MarkiDev' -Tamano $tamanoPrevia -X ($izquierda + $ladoPlaca + $hueco) -LineaBase 0
$alto = $texto.GetBounds()
$subir = [System.Drawing.Drawing2D.Matrix]::new()
$subir.Translate(0, (315 - ($alto.Top + $alto.Bottom) / 2))
$texto.Transform($subir)
$subir.Dispose()
$brocha = [System.Drawing.SolidBrush]::new($hueso)
$l.Graficos.FillPath($brocha, $texto)
$brocha.Dispose(); $texto.Dispose()

Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $publico 'og-markidev.png')
$l.Graficos.Dispose(); $l.Bitmap.Dispose()

$fuentes.Dispose()
Write-Output 'Listo.'
