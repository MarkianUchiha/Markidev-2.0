-- Migration number: 0001 	 2026-09-08T00:00:00.000Z

-- El tablero de prospectos. Las etapas se fijan aqui con CHECK y no solo en el
-- codigo: un lead con una etapa inventada rompe el tablero en silencio, y en una
-- base con 30 filas al año la deteccion tardaria meses.
CREATE TABLE leads (
  id             TEXT PRIMARY KEY,
  nombre         TEXT NOT NULL,
  -- Correo o telefono. Es opcional porque un referido puede llegar con nombre y
  -- nada mas, y perder ese registro por exigir un dato es peor que guardarlo cojo.
  contacto       TEXT,
  canal          TEXT NOT NULL CHECK (canal IN ('formulario', 'whatsapp', 'correo', 'calcom', 'referido')),
  mensaje        TEXT,
  etapa          TEXT NOT NULL DEFAULT 'nuevo'
                 CHECK (etapa IN ('nuevo', 'calificando', 'propuesta', 'negociacion', 'ganado', 'retomar', 'descartado')),
  -- Posicion dentro de su columna. Se reordena al arrastrar.
  orden          INTEGER NOT NULL DEFAULT 0,
  -- En pesos y sin decimales: no existe un lead de 30,000.50.
  valor_estimado INTEGER,
  esquema_pago   TEXT,
  -- Las dos reglas del pipeline que el usuario pidio explicitamente: descartar
  -- exige decir por que, y retomar exige una fecha. Sin esto 'retomar' se vuelve
  -- un cementerio y 'descartado' no enseña nada al revisarlo.
  motivo         TEXT,
  retomar_el     TEXT,
  creado_en      TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  CHECK (etapa <> 'descartado' OR (motivo IS NOT NULL AND motivo <> '')),
  CHECK (etapa <> 'retomar' OR (retomar_el IS NOT NULL AND retomar_el <> ''))
);

-- La consulta del tablero es siempre "dame todo agrupado por etapa y ordenado".
CREATE INDEX idx_leads_etapa_orden ON leads (etapa, orden);

-- Los que hay que retomar, por fecha. Es la unica consulta con fecha del panel.
CREATE INDEX idx_leads_retomar ON leads (retomar_el) WHERE retomar_el IS NOT NULL;

-- Historial. Reemplaza lo que en un flujo de archivos daba el historial de git:
-- quien movio que y cuando. Sin esto no hay forma de reconstruir por que un lead
-- acabo donde acabo.
CREATE TABLE lead_eventos (
  id        TEXT PRIMARY KEY,
  lead_id   TEXT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL CHECK (tipo IN ('creado', 'movido', 'editado', 'nota')),
  de_etapa  TEXT,
  a_etapa   TEXT,
  nota      TEXT,
  -- Correo del JWT de Cloudflare Access. Cuando haya empleados, esto dice quien fue.
  autor     TEXT NOT NULL,
  creado_en TEXT NOT NULL
);

CREATE INDEX idx_lead_eventos_lead ON lead_eventos (lead_id, creado_en);
