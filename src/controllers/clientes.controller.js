const pool = require('../db/connection')

const listar = async (req, res) => {
  const { buscar } = req.query
  const limite = Math.min(parseInt(req.query.limite) || 50, 200)
  const pagina = Math.max(parseInt(req.query.pagina) || 1, 1)
  const offset = (pagina - 1) * limite

  try {
    let conditions = ['activo = TRUE']
    let params = []

    if (buscar) {
      conditions.push('(nombre ILIKE $1 OR telefono ILIKE $1)')
      params.push(`%${buscar}%`)
    }

    const where = 'WHERE ' + conditions.join(' AND ')

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM clientes ${where} ORDER BY creado_en DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limite, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM clientes ${where}`, params)
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
    const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const crear = async (req, res) => {
  const { nombre, telefono, email } = req.body
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es requerido' })
  }
  try {
    const result = await pool.query(
      'INSERT INTO clientes (nombre, telefono, email) VALUES ($1, $2, $3) RETURNING *',
      [nombre, telefono || null, email || null]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const { nombre, telefono, email } = req.body
  try {
    const result = await pool.query(
      `UPDATE clientes 
       SET nombre = COALESCE($1, nombre),
           telefono = COALESCE($2, telefono),
           email = COALESCE($3, email)
       WHERE id = $4 RETURNING *`,
      [nombre || null, telefono || null, email || null, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

module.exports = { listar, obtener, crear, actualizar }