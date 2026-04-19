const pool = require('../db/connection')

// Normaliza teléfonos al formato chileno +56XXXXXXXXX
const normalizarTelefono = (tel) => {
  if (!tel) return null
  const t = String(tel).replace(/[\s\-\(\)\.]/g, '')
  if (!t) return null
  if (t.startsWith('+')) return t                          // ya tiene +, respetar
  if (/^569\d{8}$/.test(t))  return '+' + t               // 569XXXXXXXX → +569XXXXXXXX
  if (/^56[2-8]\d{7,8}$/.test(t)) return '+' + t          // 562XXXXXXXX → +562XXXXXXXX
  if (/^9\d{8}$/.test(t))    return '+56' + t             // 9XXXXXXXX → +569XXXXXXXX
  if (/^0\d{8,9}$/.test(t))  return '+56' + t.slice(1)   // 02XXXXXXXX → +562XXXXXXXX
  return tel.trim() || null
}

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
  const tel = normalizarTelefono(telefono)
  try {
    const result = await pool.query(
      'INSERT INTO clientes (nombre, telefono, email) VALUES ($1, $2, $3) RETURNING *',
      [nombre, tel, email || null]
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
  const tel = telefono !== undefined ? normalizarTelefono(telefono) : undefined
  try {
    const result = await pool.query(
      `UPDATE clientes
       SET nombre   = COALESCE($1, nombre),
           telefono = COALESCE($2, telefono),
           email    = COALESCE($3, email)
       WHERE id = $4 RETURNING *`,
      [nombre || null, tel ?? null, email || null, id]
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

// Crea o actualiza un cliente a partir de datos de BSale (upsert por bsale_id)
const upsertBsale = async (req, res) => {
  const { bsale_id, nombre, telefono, email } = req.body

  if (!bsale_id || !nombre) {
    return res.status(400).json({ error: 'bsale_id y nombre son requeridos' })
  }

  const tel = normalizarTelefono(telefono)

  try {
    const result = await pool.query(
      `INSERT INTO clientes (nombre, telefono, email, bsale_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bsale_id) DO UPDATE
         SET nombre   = EXCLUDED.nombre,
             telefono = COALESCE(EXCLUDED.telefono, clientes.telefono),
             email    = COALESCE(EXCLUDED.email,    clientes.email)
       RETURNING *`,
      [nombre, tel, email || null, bsale_id]
    )
    res.status(200).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al sincronizar cliente desde Bsale' })
  }
}

module.exports = { listar, obtener, crear, actualizar, upsertBsale }
