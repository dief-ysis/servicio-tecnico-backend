CREATE TABLE IF NOT EXISTS fotos_equipo (
  id         SERIAL PRIMARY KEY,
  equipo_id  INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  etiqueta   VARCHAR(50) DEFAULT 'general',
  subida_en  TIMESTAMP DEFAULT NOW(),
  usuario_id INTEGER REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_fotos_equipo ON fotos_equipo(equipo_id);
