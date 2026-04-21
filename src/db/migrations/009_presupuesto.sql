ALTER TABLE equipos
  ADD COLUMN IF NOT EXISTS presupuesto_monto       INTEGER,
  ADD COLUMN IF NOT EXISTS presupuesto_enviado_en  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS presupuesto_aprobado    BOOLEAN,
  ADD COLUMN IF NOT EXISTS presupuesto_aprobado_en TIMESTAMP,
  ADD COLUMN IF NOT EXISTS presupuesto_notas       TEXT;
