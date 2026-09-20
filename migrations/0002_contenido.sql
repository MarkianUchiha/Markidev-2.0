-- Migration number: 0002 	 2026-09-20T00:00:00.000Z

-- El contenido sale de los archivos y entra aqui. El objetivo no es la base en
-- si: es poder darle acceso a quien escriba sin entregarle el repositorio, y
-- que publicar u ocultar no dependa de recompilar y desplegar a mano.
--
-- Por ahora solo entra el blog. Los trabajos siguen en `src/content/work/`
-- porque el portafolio es lo que se le enseña a un cliente y no tiene por que
-- depender de la base todavia. El CHECK de `coleccion` se amplia el dia que
-- entren, y hasta entonces impide que se cuele una fila a medio migrar.
CREATE TABLE posts (
  -- El slug. Es la URL, asi que es la identidad de la fila: no hay un id
  -- sintetico aparte que permitiria dos posts peleando por /blog/mismo-slug/.
  id             TEXT PRIMARY KEY,
  coleccion      TEXT NOT NULL CHECK (coleccion IN ('blog')),
  -- El frontmatter entero como JSON. Guardarlo asi y no en una columna por
  -- campo es deliberado: el esquema del frontmatter lo define Zod en
  -- `src/lib/frontmatter.ts`, y agregar un campo no deberia costar una
  -- migracion. Lo que se filtra u ordena en SQL si tiene columna propia.
  datos          TEXT NOT NULL,
  -- El markdown tal como se subio. Es lo que permite volver a bajar el .md y
  -- regenerar el HTML si algun dia cambia el pipeline.
  cuerpo         TEXT NOT NULL,
  -- Ya convertido y saneado. Se hace una vez al guardar en vez de en cada
  -- visita: las paginas publicas solo consultan y escupen.
  html           TEXT NOT NULL,
  publicado      INTEGER NOT NULL DEFAULT 0 CHECK (publicado IN (0, 1)),
  -- ISO 8601 en TEXT, como en `leads`. Se copia del frontmatter y no se calcula
  -- aqui: manda la fecha que el autor escribio, no cuando toco la base.
  fecha          TEXT NOT NULL,
  creado_en      TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

-- La consulta del sitio publico es siempre la misma: los publicados de una
-- coleccion, del mas reciente al mas viejo.
CREATE INDEX idx_posts_publicados ON posts (coleccion, publicado, fecha DESC);

-- Reemplaza lo que en un flujo de archivos daba git gratis: que decia el post
-- antes de la ultima edicion y quien la hizo. Sin esto, subir un .md equivocado
-- pisa la version buena sin dejar rastro.
--
-- Guarda el estado ANTERIOR a cada guardado, no el nuevo: la version vigente ya
-- vive en `posts` y duplicarla seria escribir dos veces lo mismo.
CREATE TABLE post_revisiones (
  id        TEXT PRIMARY KEY,
  post_id   TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  datos     TEXT NOT NULL,
  cuerpo    TEXT NOT NULL,
  -- Correo del JWT de Cloudflare Access, igual que en `lead_eventos`.
  autor     TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE INDEX idx_post_revisiones_post ON post_revisiones (post_id, creado_en DESC);
