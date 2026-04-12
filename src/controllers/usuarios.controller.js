const bcrypt = require('bcryptjs')
const pool = require('../db/connection')

const listar = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY creado_en ASC'
    )
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const crear = async (req, res) => {
  const { nombre, email, password, rol } = req.body

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: 'nombre, email, password y rol son requeridos' })
  }

  const rolesValidos = ['recepcionista', 'tecnico']
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido. Usa recepcionista o tecnico' })
  }

  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email])
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    }

    const password_hash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, activo, creado_en`,
      [nombre, email, password_hash, rol]
    )

    res.status(201).json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const actualizar = async (req, res) => {
  const { id } = req.params
  const { nombre, rol, activo } = req.body

  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id])
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nombre  = COALESCE($1, nombre),
           rol     = COALESCE($2, rol),
           activo  = COALESCE($3, activo)
       WHERE id = $4
       RETURNING id, nombre, email, rol, activo, creado_en`,
      [nombre || null, rol || null, activo ?? null, id]
    )

    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const cambiarPassword = async (req, res) => {
  const { id } = req.params
  const { password_actual, password_nuevo } = req.body

  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ error: 'password_actual y password_nuevo son requeridos' })
  }

  if (password_nuevo.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
  }

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const usuario = result.rows[0]
    const passwordValida = await bcrypt.compare(password_actual, usuario.password_hash)

    if (!passwordValida) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    }

    const nuevo_hash = await bcrypt.hash(password_nuevo, 10)

    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [nuevo_hash, id])

    res.json({ mensaje: 'Contraseña actualizada correctamente' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

module.exports = { listar, crear, actualizar, cambiarPassword }