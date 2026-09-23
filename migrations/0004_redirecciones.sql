-- Migration number: 0004 	 2026-09-23T00:00:00.000Z

-- Las URL viejas de los articulos a los que se les cambio la direccion
-- (`specs/editar-articulo.md`). Sin esto, cambiar una URL deja en 404 a quien ya
-- tenia el enlace y tira lo que la direccion vieja habia ganado en buscadores.
CREATE TABLE post_redirecciones (
  -- El slug viejo. Clave primaria porque una URL solo puede llevar a un sitio.
  desde     TEXT PRIMARY KEY,
  -- Siempre el slug vivo: al renombrar se reapuntan todas, asi que nunca hay
  -- cadenas. Si se borra el articulo, sus URL viejas caen con el y dan 404.
  hacia     TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  creado_en TEXT NOT NULL
);

-- Al renombrar se buscan las redirecciones que apuntan al articulo.
CREATE INDEX idx_post_redirecciones_hacia ON post_redirecciones (hacia);
