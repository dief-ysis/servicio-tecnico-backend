#!/usr/bin/env node
/**
 * Script de archivado de equipos
 *
 * Mueve a equipos_archivo los equipos en estado 'entregado' con fecha de entrega
 * hace más de N días (default: 365 días / 1 año).
 *
 * También mueve el historial de cambios asociado.
 *
 * Uso:
 *   node src/scripts/archivar-equipos.js           # archiva equipos de +365 días
 *   node src/scripts/archivar-equipos.js --dias=180 # archiva equipos de +180 días
 *   node src/scripts/archivar-equipos.js --dry-run  # solo muestra cuántos se archivarían
 *
 * Recomendado: ejecutar como tarea programada mensual (ej: con node-cron o cron del sistema)
 */

require('dotenv').config()
const pool = require('../db/connection')

const args = process.argv.slice(2)
const diasArg = args.find(a => a.startsWith('--dias='))
const DIAS = diasArg ? parseInt(diasArg.split('=')[1]) : 365
const DRY_RUN = args.includes('--dry-run')

async function archivar() {
  const client = await pool.connect()
  try {
    // Contar cuántos equipos serán archivados
    const { rows: preview } = await client.query(
      `SELECT COUNT(*) AS total FROM equipos
       WHERE estado_actual = 'entregado'
       AND fecha_entrega < NOW() - ($1 || ' days')::INTERVAL`,
      [DIAS]
    )
    const total = parseInt(preview[0].total)

    console.log(`\n[Archivado] Equipos entregados hace +${DIAS} días: ${total}`)

    if (total === 0) {
      console.log('[Archivado] Nada que archivar.')
      return
    }

    if (DRY_RUN) {
      console.log('[Archivado] --dry-run activado. No se realizaron cambios.')
      return
    }

    await client.query('BEGIN')

    // 1. Copiar equipos a la tabla de archivo
    const { rows: archivados } = await client.query(
      `INSERT INTO equipos_archivo
         SELECT *, NOW() AS archivado_en FROM equipos
         WHERE estado_actual = 'entregado'
         AND fecha_entrega < NOW() - ($1 || ' days')::INTERVAL
       RETURNING id`,
      [DIAS]
    )

    const ids = archivados.map(r => r.id)
    console.log(`[Archivado] Equipos a archivar: ${ids.join(', ')}`)

    // 2. Mover historial de cambios (registrar en archivo — tabla independiente no necesaria,
    //    el historial queda en historial_cambios ligado por equipo_id)
    //    Solo eliminamos los equipos de la tabla principal.
    await client.query(
      `DELETE FROM equipos WHERE id = ANY($1::int[])`,
      [ids]
    )

    await client.query('COMMIT')
    console.log(`[Archivado] ${ids.length} equipos archivados correctamente.`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[Archivado] Error — se revirtió la transacción:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

archivar()
