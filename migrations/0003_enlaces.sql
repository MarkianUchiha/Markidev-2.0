-- Migration number: 0003 	 2026-09-21T00:00:00.000Z

-- La pagina de enlaces de las redes (`specs/pagina-de-enlaces.md`). Vive en la
-- base y no en el codigo porque su razon de ser es cambiar seguido: una campaña,
-- un producto recomendado, el sitio de un cliente. Si cambiarla obligara a
-- desplegar, se quedaria con los mismos enlaces de siempre.
CREATE TABLE enlaces (
  -- UUID generado en el Worker. A diferencia de `posts`, aqui no hay slug: la
  -- URL publica es una sola para todos y el enlace no tiene direccion propia.
  id             TEXT PRIMARY KEY,
  titulo         TEXT NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 80),
  -- La validacion completa vive en `src/lib/enlaces.ts`. Este CHECK es la red de
  -- abajo: si algun dia se inserta sin pasar por ahi, una URL `javascript:` o
  -- `data:` se rechaza igual. `//` se descarta porque el navegador lo lleva a
  -- otro dominio aunque empiece con barra.
  url            TEXT NOT NULL CHECK (
    url LIKE 'https://%' OR url LIKE 'http://%' OR (url LIKE '/%' AND url NOT LIKE '//%')
  ),
  descripcion    TEXT CHECK (descripcion IS NULL OR length(descripcion) <= 120),
  visible        INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  -- Instante ISO 8601 en UTC. Se guarda ya convertido al final del dia en hora
  -- de Mexico para que la consulta publica compare texto contra texto.
  vence_en       TEXT,
  -- Hueco entre valores no importa: subir y bajar intercambia con el vecino, no
  -- renumera la lista.
  orden          INTEGER NOT NULL,
  creado_en      TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

-- La consulta publica: los visibles, en su orden. El vencimiento se filtra
-- despues, sobre unas cuantas filas.
CREATE INDEX idx_enlaces_visibles ON enlaces (visible, orden);
