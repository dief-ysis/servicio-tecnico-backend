const pool = require('../db/connection')

const generarNumeroIngreso = async () => {
  const anio = new Date().getFullYear()
  const result = await pool.query(
    `SELECT COUNT(*) FROM equipos WHERE numero_ingreso LIKE $1`,
    [`ST-${anio}-%`]
  )
  const siguiente = parseInt(result.rows[0].count) + 1
  return `ST-${anio}-${String(siguiente).padStart(4, '0')}`
}

const registrarCambio = async (equipoId, usuarioId, campo, anterior, nuevo) => {
  await pool.query(
    `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
     VALUES ($1, $2, $3, $4, $5)`,
    [equipoId, usuarioId, campo, anterior ?? null, nuevo ?? null]
  )
}

const listar = async (req, res) => {
  const { estado, cliente_id, buscar, fecha_desde, fecha_hasta } = req.query
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

    const result = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM equipos e
       JOIN clientes c ON e.cliente_id = c.id
       ${where}
       ORDER BY e.fecha_ingreso DESC`,
      params
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const obtener = async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
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

  if (!cliente_id || !tipo_equipo) {
    return res.status(400).json({ error: 'cliente_id y tipo_equipo son requeridos' })
  }

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
  const campos = ['tipo_equipo', 'marca', 'modelo', 'falla_reportada', 'diagnostico', 'accesorios', 'observaciones', 'password_pin', 'notas_tecnico', 'costo_reparacion']

  try {
    const actual = await pool.query('SELECT * FROM equipos WHERE id = $1', [id])
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    const equipo = actual.rows[0]
    let sets = []
    let params = []
    let i = 1

    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        sets.push(`${campo} = $${i++}`)
        params.push(req.body[campo])

        if (String(equipo[campo]) !== String(req.body[campo])) {
          await registrarCambio(id, req.usuario.id, campo, equipo[campo], req.body[campo])
        }
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }

    params.push(id)
    const result = await pool.query(
      `UPDATE equipos SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    )

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const cambiarEstado = async (req, res) => {
  const { id } = req.params
  const { estado } = req.body

  const estadosValidos = ['por_reparar', 'en_reparacion', 'reparado', 'irreparable', 'entregado']
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' })
  }

  try {
    const actual = await pool.query('SELECT estado_actual FROM equipos WHERE id = $1', [id])
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    const estadoAnterior = actual.rows[0].estado_actual

    const sets = estado === 'entregado'
      ? 'estado_actual = $1, fecha_entrega = NOW()'
      : 'estado_actual = $1'

    const result = await pool.query(
      `UPDATE equipos SET ${sets} WHERE id = $2 RETURNING *`,
      [estado, id]
    )

    await registrarCambio(id, req.usuario.id, 'estado_actual', estadoAnterior, estado)

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