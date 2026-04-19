-- Migración 006: bsale_id en clientes
-- Permite vincular un cliente local con su ID en BSale
-- y evitar duplicados al crear equipos desde BSale

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS bsale_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_bsale_id
  ON clientes(bsale_id)
  WHERE bsale_id IS NOT NULL;

-- Normalizar teléfonos existentes con formato chileno (+56XXXXXXXXX)
-- Se actualiza solo si el número empieza con 9 y tiene 9 dígitos (móvil sin código país)
UPDATE clientes
SET telefono = '+56' || telefono
WHERE telefono ~ '^9[0-9]{8}$';
