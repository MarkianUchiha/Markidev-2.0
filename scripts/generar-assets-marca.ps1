<#
  Genera los PNG de marca que vive en public/: el icono de iOS, el respaldo del
  favicon y la imagen de previa que ven WhatsApp y los rastreadores.

  Se corre a mano, no en el build. Los tres archivos cambian solo si cambia la
  marca:

      pwsh -File scripts/generar-assets-marca.ps1

  POR QUE POWERSHELL Y NO UN .mjs COMO EL RESTO DE scripts/
  El proyecto no tiene `sharp` —el adapter de Cloudflare no lo arrastra— y
  meter una dependencia de imagen para tres archivos que se generan una vez no
  se paga. System.Drawing ya viene con Windows.

  POR QUE SE DIBUJA Y NO SE REESCALA brand/*.png
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
$salida = Join-Path $raiz 'public'

# Paleta. Los mismos hex que src/styles/global.css; aqui se repiten porque GDI+
# no lee CSS, no porque haya dos fuentes de verdad.
$purpura = [System.Drawing.ColorTranslator]::FromHtml('#684198')
$naranja = [System.Drawing.ColorTranslator]::FromHtml('#FF9900')
$verde   = [System.Drawing.ColorTranslator]::FromHtml('#85FF00')
$negro   = [System.Drawing.ColorTranslator]::FromHtml('#121212')
$hueso   = [System.Drawing.ColorTranslator]::FromHtml('#FAFAF9')

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

function Save-Png {
    param([System.Drawing.Bitmap]$Bitmap, [string]$Ruta)

    $Bitmap.Save($Ruta, [System.Drawing.Imaging.ImageFormat]::Png)
    $kb = [math]::Round((Get-Item $Ruta).Length / 1KB, 1)
    Write-Output ("  {0,-24} {1,4}x{2,-4} {3,6} KB" -f (Split-Path -Leaf $Ruta), $Bitmap.Width, $Bitmap.Height, $kb)
}

Write-Output 'Generando assets de marca:'

# --- Icono de iOS: 180x180, a sangre, sin alfa ---------------------------------
# La placa ocupa 180 unidades del viewBox y el destino mide 180 px, asi que la
# escala es 1:1 y solo hay que correr el origen 10 unidades.
$l = New-Lienzo -Ancho 180 -Alto 180
$brocha = [System.Drawing.SolidBrush]::new($purpura)
$l.Graficos.FillRectangle($brocha, 0, 0, 180, 180)
$brocha.Dispose()
Add-ChevronYPunto -G $l.Graficos -Escala 1 -DesplazaX -10 -DesplazaY -10 -ColorTrazo $hueso -ColorPunto $naranja
Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $salida 'apple-touch-icon.png')
$l.Graficos.Dispose(); $l.Bitmap.Dispose()

# --- Respaldo del favicon: 32x32, redondeado, con alfa -------------------------
$escala = 32 / 180
$l = New-Lienzo -Ancho 32 -Alto 32
$placa = New-RectanguloRedondo -X 0 -Y 0 -Ancho 32 -Alto 32 -Radio (40 * $escala)
$brocha = [System.Drawing.SolidBrush]::new($purpura)
$l.Graficos.FillPath($brocha, $placa)
$brocha.Dispose(); $placa.Dispose()
Add-ChevronYPunto -G $l.Graficos -Escala $escala -DesplazaX (-10 * $escala) -DesplazaY (-10 * $escala) -ColorTrazo $hueso -ColorPunto $naranja
Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $salida 'favicon-32.png')
$l.Graficos.Dispose(); $l.Bitmap.Dispose()

# --- Previa para compartir: 1200x630 ------------------------------------------
# Sobre morado va la variante oscura del isotipo: la placa morada desapareceria
# contra el fondo. Naranja sobre morado da 3.51, que alcanza para una forma
# grande, y el nombre en blanco hueso se lee de sobra.
#
# El texto se dibuja con Poppins 700 descargada de Google Fonts: GDI+ no lee
# woff2, que es lo unico que Astro cachea en .astro/fonts/. El .ttf se queda en
# el temporal y no entra al repositorio.
$ttf = Join-Path ([System.IO.Path]::GetTempPath()) 'Poppins-Bold.ttf'
if (-not (Test-Path $ttf)) {
    Write-Output '  descargando Poppins 700 (OFL) ...'
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf' -OutFile $ttf
}

$fuentes = [System.Drawing.Text.PrivateFontCollection]::new()
$fuentes.AddFontFile($ttf)
$familia = $fuentes.Families[0]
$fuente = [System.Drawing.Font]::new($familia, 116, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$l = New-Lienzo -Ancho 1200 -Alto 630
$brocha = [System.Drawing.SolidBrush]::new($purpura)
$l.Graficos.FillRectangle($brocha, 0, 0, 1200, 630)
$brocha.Dispose()

$ladoPlaca = 200
$hueco = 44
$formato = [System.Drawing.StringFormat]::GenericTypographic
$anchoTexto = $l.Graficos.MeasureString('MarkiDev', $fuente, [System.Drawing.PointF]::Empty, $formato).Width

# El grupo entero se centra, no cada pieza por su lado: si se centraran aparte,
# el aire entre isotipo y nombre cambiaria con el largo del nombre.
$izquierda = (1200 - ($ladoPlaca + $hueco + $anchoTexto)) / 2
$arriba = (630 - $ladoPlaca) / 2

$escala = $ladoPlaca / 180
$placa = New-RectanguloRedondo -X $izquierda -Y $arriba -Ancho $ladoPlaca -Alto $ladoPlaca -Radio (40 * $escala)
$brocha = [System.Drawing.SolidBrush]::new($naranja)
$l.Graficos.FillPath($brocha, $placa)
$brocha.Dispose(); $placa.Dispose()
Add-ChevronYPunto -G $l.Graficos -Escala $escala -DesplazaX ($izquierda - 10 * $escala) -DesplazaY ($arriba - 10 * $escala) -ColorTrazo $negro -ColorPunto $verde

# La caja de la fuente es mas alta que las letras. Se centra por la altura real
# de las mayusculas para que el nombre quede a la par del isotipo y no flotando.
$alturaTexto = $fuente.GetHeight($l.Graficos)
$brocha = [System.Drawing.SolidBrush]::new($hueso)
$l.Graficos.DrawString('MarkiDev', $fuente, $brocha, ($izquierda + $ladoPlaca + $hueco), (315 - $alturaTexto / 2), $formato)
$brocha.Dispose()

Save-Png -Bitmap $l.Bitmap -Ruta (Join-Path $salida 'og-markidev.png')
$l.Graficos.Dispose(); $l.Bitmap.Dispose()
$fuente.Dispose(); $fuentes.Dispose()

Write-Output 'Listo.'
