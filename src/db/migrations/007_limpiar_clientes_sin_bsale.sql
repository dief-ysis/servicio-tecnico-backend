-- Migración 007: Limpiar clientes de prueba sin vínculo BSale
-- Borra en cascada: historial → equipos → clientes sin bsale_id

-- 1. Borrar historial de equipos de clientes sin bsale_id
DELETE FROM historial_cambios
WHERE equipo_id IN (
  SELECT e.id FROM equipos e
  JOIN clientes c ON e.cliente_id = c.id
  WHERE c.bsale_id IS NULL
);

-- 2. Borrar los equipos de esos clientes
DELETE FROM equipos
WHERE cliente_id IN (
  SELECT id FROM clientes WHERE bsale_id IS NULL
);

-- 3. Borrar los clientes sin bsale_id
DELETE FROM clientes
WHERE bsale_id IS NULL;
