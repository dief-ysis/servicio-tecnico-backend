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
  const { periodo = 'mes', usuario_id } = req.query
  const intervalos = { semana: 7, mes: 30, año: 365 }
  const dias = intervalos[periodo] ?? 30

  // Si se filtra por técnico, hacemos join con historial_cambios
  const usuarioFiltro = usuario_id ? parseInt(usuario_id) : null

  try {
    let totales, porDia, costos

    if (usuarioFiltro) {
      // Equipos cuyo historial tiene al menos un cambio del técnico seleccionado en el período
      totales = await pool.query(
        `SELECT e.estado_actual, COUNT(DISTINCT e.id) as total
         FROM equipos e
         JOIN historial_cambios h ON h.equipo_id = e.id
         WHERE h.usuario_id = $2
           AND e.fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
         GROUP BY e.estado_actual`,
        [dias, usuarioFiltro]
      )

      porDia = await pool.query(
        `SELECT DATE(e.fecha_ingreso) as fecha, COUNT(DISTINCT e.id) as ingresos
         FROM equipos e
         JOIN historial_cambios h ON h.equipo_id = e.id
         WHERE h.usuario_id = $2
           AND e.fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
         GROUP BY DATE(e.fecha_ingreso)
         ORDER BY fecha ASC`,
        [dias, usuarioFiltro]
      )

      costos = await pool.query(
        `SELECT
          COUNT(DISTINCT e.id) FILTER (WHERE e.costo_reparacion IS NOT NULL) as con_costo,
          SUM(DISTINCT e.costo_reparacion) as total_facturado,
          AVG(e.costo_reparacion) as promedio
         FROM equipos e
         JOIN historial_cambios h ON h.equipo_id = e.id
         WHERE h.usuario_id = $2
           AND e.fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
           AND e.estado_actual IN ('reparado', 'entregado')`,
        [dias, usuarioFiltro]
      )
    } else {
      totales = await pool.query(
        `SELECT estado_actual, COUNT(*) as total
         FROM equipos
         WHERE fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
         GROUP BY estado_actual`,
        [dias]
      )

      porDia = await pool.query(
        `SELECT DATE(fecha_ingreso) as fecha, COUNT(*) as ingresos
         FROM equipos
         WHERE fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
         GROUP BY DATE(fecha_ingreso)
         ORDER BY fecha ASC`,
        [dias]
      )

      costos = await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE costo_reparacion IS NOT NULL) as con_costo,
          SUM(costo_reparacion) as total_facturado,
          AVG(costo_reparacion) as promedio
         FROM equipos
         WHERE fecha_ingreso >= NOW() - ($1 || ' days')::INTERVAL
         AND estado_actual IN ('reparado', 'entregado')`,
        [dias]
      )
    }

    res.json({
      periodo,
      usuario_id: usuarioFiltro,
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
  const etiqueta = req.body.etiqueta || req.query.etiqueta || 'general'
  const etiquetasValidas = ['recepcion', 'reparacion', 'entrega', 'general']
  const etiquetaFinal = etiquetasValidas.includes(etiqueta) ? etiqueta : 'general'

  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' })

    const resultado = await subirACloudinary(req.file.buffer, req.file.mimetype)

    // Actualizar foto_url en equipos (compatibilidad)
    await pool.query(
      'UPDATE equipos SET foto_url = $1 WHERE id = $2',
      [resultado.secure_url, id]
    )

    // Insertar en fotos_equipo
    await pool.query(
      `INSERT INTO fotos_equipo (equipo_id, url, etiqueta, usuario_id)
       VALUES ($1, $2, $3, $4)`,
      [id, resultado.secure_url, etiquetaFinal, req.usuario.id]
    )

    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'foto_url', NULL, $3)`,
      [id, req.usuario.id, resultado.secure_url]
    )

    res.json({ foto_url: resultado.secure_url, etiqueta: etiquetaFinal })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al subir imagen' })
  }
})

router.get('/:id/fotos', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT f.id, f.url, f.etiqueta, f.subida_en, u.nombre AS usuario_nombre
       FROM fotos_equipo f
       LEFT JOIN usuarios u ON f.usuario_id = u.id
       WHERE f.equipo_id = $1
       ORDER BY f.subida_en DESC`,
      [id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al obtener fotos' })
  }
})

router.delete('/:id/fotos/:foto_id', requireRol('tecnico'), async (req, res) => {
  const { id, foto_id } = req.params
  try {
    const result = await pool.query(
      'DELETE FROM fotos_equipo WHERE id = $1 AND equipo_id = $2 RETURNING id',
      [foto_id, id]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'Foto no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al eliminar foto' })
  }
})

// POST /equipos/:id/presupuesto — enviar presupuesto al cliente
router.post('/:id/presupuesto', requireRol('tecnico'), async (req, res) => {
  const { monto, notas } = req.body
  if (!monto || monto <= 0) return res.status(400).json({ error: 'Monto requerido' })
  try {
    const r = await pool.query(
      `UPDATE equipos SET presupuesto_monto=$1, presupuesto_enviado_en=NOW(),
       presupuesto_aprobado=NULL, presupuesto_aprobado_en=NULL, presupuesto_notas=$2
       WHERE id=$3 RETURNING *`,
      [monto, notas || null, req.params.id]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' })
    // Registrar en historial
    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_nuevo)
       VALUES ($1,$2,'presupuesto_enviado',$3)`,
      [req.params.id, req.usuario.id, `$${Number(monto).toLocaleString('es-CL')}`]
    )
    res.json(r.rows[0])
  } catch(err) { console.error(err); res.status(500).json({ error: 'Error interno' }) }
})

// PATCH /equipos/:id/presupuesto — aprobar o rechazar
router.patch('/:id/presupuesto', requireRol('tecnico'), async (req, res) => {
  const { aprobado, notas } = req.body // aprobado: true | false
  if (aprobado === undefined) return res.status(400).json({ error: 'Campo aprobado requerido' })
  try {
    const r = await pool.query(
      `UPDATE equipos SET presupuesto_aprobado=$1, presupuesto_aprobado_en=NOW(),
       presupuesto_notas=COALESCE($2, presupuesto_notas)
       WHERE id=$3 RETURNING *`,
      [aprobado, notas || null, req.params.id]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' })
    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_nuevo)
       VALUES ($1,$2,'presupuesto_respuesta',$3)`,
      [req.params.id, req.usuario.id, aprobado ? 'aprobado' : 'rechazado']
    )
    res.json(r.rows[0])
  } catch(err) { console.error(err); res.status(500).json({ error: 'Error interno' }) }
})

// POST /equipos/:id/firma — guarda firma digital (base64 → Cloudinary)
router.post('/:id/firma', requireRol('recepcionista', 'tecnico'), async (req, res) => {
  const { firma_base64 } = req.body
  if (!firma_base64) return res.status(400).json({ error: 'Firma requerida' })
  try {
    const buffer = Buffer.from(firma_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    const result = await subirACloudinary(buffer, 'image/png')
    await pool.query('UPDATE equipos SET firma_url=$1 WHERE id=$2', [result.secure_url, req.params.id])
    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_nuevo)
       VALUES ($1,$2,'firma_digital','capturada')`,
      [req.params.id, req.usuario.id]
    )
    res.json({ firma_url: result.secure_url })
  } catch(err) { console.error(err); res.status(500).json({ error: 'Error al guardar firma' }) }
})

module.exports = router