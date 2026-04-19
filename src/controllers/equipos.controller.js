const pool = require('../db/connection')
const { notificarReparado, notificarIrreparable } = require('../services/notificaciones.service')

const generarNumeroIngreso = async () => {
  const anio = new Date().getFullYear()
  // Operación atómica — sin race condition bajo carga concurrente
  const result = await pool.query(
    `SELECT siguiente_numero_ingreso($1::SMALLINT) AS siguiente`,
    [anio]
  )
  const siguiente = result.rows[0].siguiente
  return `ST-${anio}-${String(siguiente).padStart(4, '0')}`
}

const registrarCambio = async (equipoId, usuarioId, campo, anterior, nuevo) => {
  await pool.query(
    `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
     VALUES ($1, $2, $3, $4, $5)`,
    [equipoId, usuarioId, campo, anterior ?? null, nuevo ?? null]
  )
}

// Versión en lote: inserta varios cambios en una sola query
const registrarCambios = async (equipoId, usuarioId, cambios) => {
  if (cambios.length === 0) return
  const valores = cambios.flatMap(({ campo, anterior, nuevo }) => [
    equipoId, usuarioId, campo, anterior ?? null, nuevo ?? null
  ])
  const filas = cambios.map((_, i) => {
    const base = i * 5
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
  }).join(', ')
  await pool.query(
    `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
     VALUES ${filas}`,
    valores
  )
}

const listar = async (req, res) => {
  const { estado, cliente_id, buscar, fecha_desde, fecha_hasta } = req.query
  const limite = Math.min(parseInt(req.query.limite) || 50, 200)
  const pagina = Math.max(parseInt(req.query.pagina) || 1, 1)
  const offset = (pagina - 1) * limite

  try {
    let conditions = []
    let params = []
    let i = 1

    if (estado) {
      conditions.push(`e.estado_actual = $${i++}`)
      params.push(estado)
    }
    if (cliente_id) {
      conditions.push(`e.cliente_id = $${i++}`)
      params.push(cliente_id)
    }
    if (buscar) {
      conditions.push(`(c.nombre ILIKE $${i} OR e.numero_ingreso ILIKE $${i} OR e.marca ILIKE $${i})`)
      params.push(`%${buscar}%`)
      i++
    }
    if (fecha_desde) {
      conditions.push(`e.fecha_ingreso >= $${i++}`)
      params.push(fecha_desde)
    }
    if (fecha_hasta) {
      conditions.push(`e.fecha_ingreso <= $${i++}`)
      params.push(`${fecha_hasta}T23:59:59`)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.bsale_id AS cliente_bsale_id
         FROM equipos e
         JOIN clientes c ON e.cliente_id = c.id
         ${where}
         ORDER BY e.fecha_ingreso DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limite, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM equipos e JOIN clientes c ON e.cliente_id = c.id ${where}`,
        params
      )
    ])

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      pagina,
      limite,
      paginas: Math.ceil(parseInt(countResult.rows[0].count) / limite)
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const obtener = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.bsale_id AS cliente_bsale_id
       FROM equipos e
       JOIN clientes c ON e.cliente_id = c.id
       WHERE e.id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const crear = async (req, res) => {
  const { cliente_id, tipo_equipo, marca, modelo, falla_reportada, accesorios, observaciones, password_pin } = req.body

  try {
    const numero_ingreso = await generarNumeroIngreso()

    const result = await pool.query(
      `INSERT INTO equipos 
        (numero_ingreso, cliente_id, tipo_equipo, marca, modelo, falla_reportada, accesorios, observaciones, password_pin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [numero_ingreso, cliente_id, tipo_equipo, marca || null, modelo || null,
       falla_reportada || null, accesorios || null, observaciones || null, password_pin || null]
    )

    await registrarCambio(result.rows[0].id, req.usuario.id, 'estado_actual', null, 'por_reparar')

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const campos = ['tipo_equipo', 'marca', 'modelo', 'falla_reportada', 'diagnostico', 'accesorios', 'observaciones', 'password_pin', 'notas_tecnico', 'costo_reparacion', 'garantia_dias']

  try {
    const actual = await pool.query('SELECT * FROM equipos WHERE id = $1', [id])
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    const equipo = actual.rows[0]
    let sets = []
    let params = []
    let i = 1
    const cambios = []

    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        sets.push(`${campo} = $${i++}`)
        params.push(req.body[campo])

        if (String(equipo[campo]) !== String(req.body[campo])) {
          cambios.push({ campo, anterior: equipo[campo], nuevo: req.body[campo] })
        }
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }

    params.push(id)
    const [result] = await Promise.all([
      pool.query(`UPDATE equipos SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, params),
      registrarCambios(id, req.usuario.id, cambios)
    ])

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const cambiarEstado = async (req, res) => {
  const { id } = req.params
  const { estado } = req.body

  try {
    const actual = await pool.query(
      `SELECT e.estado_actual, e.numero_ingreso, e.tipo_equipo, e.marca, e.modelo,
              e.costo_reparacion, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM equipos e
       JOIN clientes c ON e.cliente_id = c.id
       WHERE e.id = $1`,
      [id]
    )
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    const equipoActual = actual.rows[0]
    const estadoAnterior = equipoActual.estado_actual

    const sets = estado === 'entregado'
      ? 'estado_actual = $1, fecha_entrega = NOW()'
      : 'estado_actual = $1'

    const result = await pool.query(
      `UPDATE equipos SET ${sets} WHERE id = $2 RETURNING *`,
      [estado, id]
    )

    await registrarCambio(id, req.usuario.id, 'estado_actual', estadoAnterior, estado)

    // Notificar al cliente cuando el equipo queda listo o es irreparable
    if (estado === 'reparado') {
      notificarReparado({ id, ...equipoActual })
    } else if (estado === 'irreparable') {
      notificarIrreparable({ id, ...equipoActual })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const historial = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT h.*, u.nombre AS usuario_nombre
       FROM historial_cambios h
       JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.equipo_id = $1
       ORDER BY h.fecha_cambio DESC`,
      [id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, historial }