require('dotenv').config()
const app = require('./app')
const cron = require('node-cron')
const pool = require('./db/connection')
const { notificarGarantia } = require('./services/notificaciones.service')

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})

// ── Cron: archivar equipos entregados/irreparables > 90 días ─────────────────
// Corre el día 1 de cada mes a las 3:00 AM
cron.schedule('0 3 1 * *', async () => {
  console.log('[cron] Iniciando archivado automático de equipos...')
  try {
    const result = await pool.query(`
      UPDATE equipos
      SET archivado = TRUE
      WHERE archivado = FALSE
        AND estado_actual IN ('entregado', 'irreparable')
        AND fecha_ingreso < NOW() - INTERVAL '90 days'
    `)
    console.log(`[cron] Archivados: ${result.rowCount} equipos`)
  } catch (err) {
    console.error('[cron] Error en archivado:', err.message)
  }
}, { timezone: 'America/Santiago' })

// ── Cron: notificar garantías por vencer (próximos 7 días) ───────────────────
// Corre todos los lunes a las 9:00 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('[cron] Verificando garantías por vencer...')
  try {
    const result = await pool.query(`
      SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
      FROM equipos e
      LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE e.garantia_hasta IS NOT NULL
        AND e.garantia_hasta > NOW()
        AND e.garantia_hasta <= NOW() + INTERVAL '7 days'
        AND e.estado_actual = 'entregado'
        AND e.archivado = FALSE
    `)
    console.log(`[cron] Garantías por vencer: ${result.rowCount} equipos`)
    for (const equipo of result.rows) {
      const diasRestantes = Math.ceil(
        (new Date(equipo.garantia_hasta) - new Date()) / (1000 * 60 * 60 * 24)
      )
      await notificarGarantia(equipo, diasRestantes)
    }
  } catch (err) {
    console.error('[cron] Error en garantías:', err.message)
  }
}, { timezone: 'America/Santiago' })
