const router = require('express').Router()
const pool = require('../db/connection')
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Demasiadas consultas' } })

// GET /public/equipos/:numero_ingreso
router.get('/equipos/:numero_ingreso', limiter, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT e.numero_ingreso, e.tipo_equipo, e.marca, e.modelo,
              e.estado_actual, e.diagnostico, e.costo_reparacion,
              e.garantia_dias, e.fecha_ingreso, e.fecha_entrega,
              (CASE WHEN e.garantia_dias > 0 AND e.fecha_entrega IS NOT NULL
                THEN e.fecha_entrega + (e.garantia_dias || ' days')::INTERVAL
                ELSE NULL END) AS garantia_hasta
       FROM equipos e
       WHERE UPPER(e.numero_ingreso) = UPPER($1) AND e.archivado = FALSE`,
      [req.params.numero_ingreso.trim()]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' })
    res.json(r.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
