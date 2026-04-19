require('dotenv').config()
const app = require('./app')
const cron = require('node-cron')
const pool = require('./db/connection')

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
