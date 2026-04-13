const pool = require('../db/connection')
const { upload, subirACloudinary } = require('../middlewares/upload.middleware')
const router = require('express').Router()
const { listar, obtener, crear, actualizar, cambiarEstado, historial } = require('../controllers/equipos.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')

router.use(verificarToken)

/**
 * @swagger
 * /equipos:
 *   get:
 *     summary: Listar equipos
 *     tags: [Equipos]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [por_reparar, en_reparacion, reparado, irreparable, entregado]
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lista de equipos con datos del cliente
 */
router.get('/', listar)
router.get('/:id', obtener)
router.get('/:id/historial', historial)
router.post('/', requireRol('recepcionista', 'tecnico'), crear)
router.patch('/:id', requireRol('tecnico'), actualizar)

/**
 * @swagger
 * /equipos/{id}/estado:
 *   patch:
 *     summary: Cambiar estado de un equipo
 *     tags: [Equipos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [por_reparar, en_reparacion, reparado, irreparable, entregado]
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Estado inválido
 */
router.patch('/:id/estado', requireRol('tecnico'), cambiarEstado)

/**
 * @swagger
 * /equipos/estadisticas:
 *   get:
 *     summary: Estadísticas de equipos por período
 *     tags: [Equipos]
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [semana, mes, año]
 */
router.get('/estadisticas', verificarToken, async (req, res) => {
  const { periodo = 'mes' } = req.query
  const intervalos = { semana: '7 days', mes: '30 days', año: '365 days' }
  const intervalo = intervalos[periodo] ?? '30 days'

  try {
    const totales = await pool.query(
      `SELECT estado_actual, COUNT(*) as total
       FROM equipos
       WHERE fecha_ingreso >= NOW() - INTERVAL '${intervalo}'
       GROUP BY estado_actual`
    )

    const porDia = await pool.query(
      `SELECT DATE(fecha_ingreso) as fecha, COUNT(*) as ingresos
       FROM equipos
       WHERE fecha_ingreso >= NOW() - INTERVAL '${intervalo}'
       GROUP BY DATE(fecha_ingreso)
       ORDER BY fecha ASC`
    )

    const costos = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE costo_reparacion IS NOT NULL) as con_costo,
        SUM(costo_reparacion) as total_facturado,
        AVG(costo_reparacion) as promedio
       FROM equipos
       WHERE fecha_ingreso >= NOW() - INTERVAL '${intervalo}'
       AND estado_actual IN ('reparado', 'entregado')`
    )

    res.json({
      periodo,
      totales: totales.rows,
      porDia: porDia.rows,
      costos: costos.rows[0]
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/sin-movimiento', verificarToken, async (req, res) => {
  const { dias = 7 } = req.query
  try {
    const result = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
              MAX(h.fecha_cambio) AS ultimo_cambio
       FROM equipos e
       JOIN clientes c ON e.cliente_id = c.id
       LEFT JOIN historial_cambios h ON h.equipo_id = e.id
       WHERE e.estado_actual IN ('por_reparar', 'en_reparacion')
       GROUP BY e.id, c.nombre, c.telefono
       HAVING MAX(h.fecha_cambio) < NOW() - INTERVAL '${parseInt(dias)} days'
          OR MAX(h.fecha_cambio) IS NULL
       ORDER BY ultimo_cambio ASC NULLS FIRST`,
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/:id/foto', verificarToken, requireRol('tecnico', 'recepcionista'), upload.single('foto'), async (req, res) => {
  const { id } = req.params
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    const resultado = await subirACloudinary(req.file.buffer, req.file.mimetype)

    await pool.query(
      'UPDATE equipos SET foto_url = $1 WHERE id = $2',
      [resultado.secure_url, id]
    )

    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'foto_url', NULL, $3)`,
      [id, req.usuario.id, resultado.secure_url]
    )

    res.json({ foto_url: resultado.secure_url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al subir imagen' })
  }
})

module.exports = router