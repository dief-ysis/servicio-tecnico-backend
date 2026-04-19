const pool = require('../db/connection')
const { upload, subirACloudinary } = require('../middlewares/upload.middleware')
const router = require('express').Router()
const { listar, obtener, crear, actualizar, cambiarEstado, historial } = require('../controllers/equipos.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { crearEquipoSchema, actualizarEquipoSchema, cambiarEstadoSchema } = require('../schemas')

router.use(verificarToken)

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
router.get('/estadisticas', async (req, res) => {
  const { periodo = 'mes' } = req.query
  const intervalos = { semana: 7, mes: 30, año: 365 }
  const dias = intervalos[periodo] ?? 30

  try {
    const totales = await pool.query(
      `SELECT estado_actual, COUNT(*) as total
       FROM equipos
       WHERE fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY estado_actual`,
      [dias]
    )

    const porDia = await pool.query(
      `SELECT DATE(fecha_ingreso) as fecha, COUNT(*) as ingresos
       FROM equipos
       WHERE fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE(fecha_ingreso)
       ORDER BY fecha ASC`,
      [dias]
    )

    const costos = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE costo_reparacion IS NOT NULL) as con_costo,
        SUM(costo_reparacion) as total_facturado,
        AVG(costo_reparacion) as promedio
       FROM equipos
       WHERE fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
       AND estado_actual IN ('reparado', 'entregado')`,
      [dias]
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

/**
 * @swagger
 * /equipos/sin-movimiento:
 *   get:
 *     summary: Equipos sin movimiento en N días
 *     tags: [Equipos]
 *     parameters:
 *       - in: query
 *         name: dias
 *         schema: { type: integer, default: 7 }
 *     responses:
 *       200:
 *         description: Lista de equipos sin cambio de estado en el período
 */
router.get('/sin-movimiento', async (req, res) => {
  const dias = parseInt(req.query.dias ?? 7)
  try {
    const result = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
              MAX(h.fecha_cambio) AS ultimo_cambio
       FROM equipos e
       JOIN clientes c ON e.cliente_id = c.id
       LEFT JOIN historial_cambios h ON h.equipo_id = e.id
       WHERE e.estado_actual IN ('por_reparar', 'en_reparacion')
       GROUP BY e.id, c.nombre, c.telefono
       HAVING MAX(h.fecha_cambio) < NOW() - ($1 || ' days')::INTERVAL
          OR MAX(h.fecha_cambio) IS NULL
       ORDER BY ultimo_cambio ASC NULLS FIRST`,
      [dias]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Endpoint consolidado de alertas para el dashboard
router.get('/alertas', async (req, res) => {
  try {
    const [
      conteoResult,
      sinMovimientoResult,
      esperaRepuestoResult,
      garantiasResult,
      listosResult
    ] = await Promise.all([
      // Conteo por estado (todos los activos)
      pool.query(`
        SELECT estado_actual, COUNT(*) AS total
        FROM equipos
        WHERE estado_actual NOT IN ('entregado', 'irreparable')
        GROUP BY estado_actual
      `),
      // Sin movimiento > 7 días en estados activos
      pool.query(`
        SELECT e.id, e.numero_ingreso, e.tipo_equipo, e.marca, e.modelo,
               e.estado_actual, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
               MAX(h.fecha_cambio) AS ultimo_cambio
        FROM equipos e
        JOIN clientes c ON e.cliente_id = c.id
        LEFT JOIN historial_cambios h ON h.equipo_id = e.id
        WHERE e.estado_actual IN ('por_reparar', 'en_reparacion')
        GROUP BY e.id, c.nombre, c.telefono
        HAVING MAX(h.fecha_cambio) < NOW() - INTERVAL '7 days' OR MAX(h.fecha_cambio) IS NULL
        ORDER BY ultimo_cambio ASC NULLS FIRST
        LIMIT 20
      `),
      // Espera repuesto > 14 días
      pool.query(`
        SELECT e.id, e.numero_ingreso, e.tipo_equipo, e.marca, e.modelo,
               e.estado_actual, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
               MAX(h.fecha_cambio) AS ultimo_cambio
        FROM equipos e
        JOIN clientes c ON e.cliente_id = c.id
        LEFT JOIN historial_cambios h ON h.equipo_id = e.id
        WHERE e.estado_actual = 'espera_repuesto'
        GROUP BY e.id, c.nombre, c.telefono
        HAVING MAX(h.fecha_cambio) < NOW() - INTERVAL '14 days' OR MAX(h.fecha_cambio) IS NULL
        ORDER BY ultimo_cambio ASC NULLS FIRST
        LIMIT 20
      `),
      // Garantías que vencen en los próximos 7 días
      pool.query(`
        SELECT e.id, e.numero_ingreso, e.tipo_equipo, e.marca, e.modelo,
               e.garantia_dias, e.fecha_entrega,
               (e.fecha_entrega + (e.garantia_dias || ' days')::INTERVAL) AS garantia_hasta,
               c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
        FROM equipos e
        JOIN clientes c ON e.cliente_id = c.id
        WHERE e.estado_actual = 'entregado'
          AND e.garantia_dias > 0
          AND e.fecha_entrega IS NOT NULL
          AND (e.fecha_entrega + (e.garantia_dias || ' days')::INTERVAL) BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY garantia_hasta ASC
        LIMIT 20
      `),
      // Listos para entregar (estado reparado)
      pool.query(`
        SELECT e.id, e.numero_ingreso, e.tipo_equipo, e.marca, e.modelo,
               e.costo_reparacion, e.fecha_ingreso,
               c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
        FROM equipos e
        JOIN clientes c ON e.cliente_id = c.id
        WHERE e.estado_actual = 'reparado'
        ORDER BY e.fecha_ingreso ASC
      `)
    ])

    const conteo = {}
    for (const row of conteoResult.rows) {
      conteo[row.estado_actual] = parseInt(row.total)
    }

    res.json({
      conteo,
      sin_movimiento:        sinMovimientoResult.rows,
      espera_repuesto_critico: esperaRepuestoResult.rows,
      garantias_por_vencer:  garantiasResult.rows,
      listos:                listosResult.rows
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

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
router.post('/', requireRol('recepcionista', 'tecnico'), validate(crearEquipoSchema), crear)
router.patch('/:id', requireRol('tecnico'), validate(actualizarEquipoSchema), actualizar)

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
router.patch('/:id/estado', requireRol('tecnico'), validate(cambiarEstadoSchema), cambiarEstado)

router.post('/:id/foto', requireRol('tecnico', 'recepcionista'), upload.single('foto'), async (req, res) => {
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