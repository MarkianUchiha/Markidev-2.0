---
title: "¿Por qué mi página no aparece en Google?"
question: "¿Por qué mi página no aparece en Google?"
description: "Tu sitio existe pero nadie lo encuentra. Repaso las cuatro causas que veo más seguido en negocios reales y cómo comprobar cuál te está pasando."
pubDate: 2026-09-09
tags: ["SEO", "Google", "Sitios web"]
---

Es la pregunta que más me hacen, y casi siempre viene con la misma frustración
detrás: **pagaste por una página y no sirve de nada porque nadie la encuentra**.
La buena noticia es que las causas son pocas y se comprueban en diez minutos.

## Primero: comprueba si Google ya te tiene

Antes de suponer nada, pregúntale a Google directamente. Escribe esto en la
barra de búsqueda, con tu dominio en lugar del mío:

```
site:markidev.com
```

Si salen resultados, Google sí te tiene indexado y el problema es de
posicionamiento. Si no sale ninguno, ni siquiera sabe que existes, y eso es otra
conversación.

## Las cuatro causas que veo más seguido

### 1. El sitio le está diciendo a Google que no entre

Suena absurdo, pero pasa. Muchos sitios se construyen con una instrucción de
bloqueo puesta a propósito mientras se trabaja, y a nadie se le ocurre quitarla
el día que se publica. Se ve así:

```html
<meta name="robots" content="noindex, nofollow" />
```

Esa línea le pide a Google que ignore la página. También puede estar en el
archivo `robots.txt`. Abre `tudominio.com/robots.txt` y si ves `Disallow: /`,
ahí está tu respuesta.

### 2. Nadie te enlaza y nadie te busca por tu nombre

Google no sale a buscar sitios nuevos: los descubre porque alguien los enlaza.
Si tu página no está en tu perfil de negocio, ni en tus redes, ni en el
directorio de tu cámara de comercio, para Google no existe.

### 3. Compites por palabras que no te tocan

Es la más dolorosa. Un taller mecánico que quiere salir primero en
«mecánico automotriz» está peleando contra todo el país. En cambio:

| Lo que se busca | Competencia | Qué tan realista es |
| --- | --- | --- |
| mecánico automotriz | Nacional | Casi imposible |
| mecánico en tu ciudad | Local | Difícil pero se puede |
| cambio de clutch en tu ciudad | Local y específica | Alcanzable |

La tercera trae menos visitas y más clientes. Es la que quieres.

### 4. La página tarda demasiado en cargar

Google mide cuánto tarda tu sitio en mostrar algo útil. Si tarda más de dos
segundos y medio en un celular con datos, te penaliza. Las causas casi siempre
son las mismas:

- Fotos subidas tal cual salieron de la cámara, de cuatro megas cada una
- Plantillas que cargan seis tipografías cuando usan dos
- Complementos que se instalaron una vez y se quedaron ahí

## Lo que le digo a cada cliente que llega con esto

> Estar en Google no es un servicio que se contrata una vez. Es una consecuencia
> de tener un sitio que carga rápido, que dice claramente a qué te dedicas y que
> alguien más considera digno de enlazar.

---

Si revisaste los cuatro puntos y sigues sin entender qué te está pasando,
[escríbeme y lo vemos juntos](/contacto/). Reviso el sitio y te digo qué
encontré, sin compromiso.
