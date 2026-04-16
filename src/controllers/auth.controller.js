const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db/connection')

// Opciones del cookie de sesión
// SameSite=None es necesario porque frontend (Vercel) y backend (Render) son dominios distintos
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 8 * 60 * 60 * 1000 // 8 horas en ms
}

const registrarLog = async (email, ip, exitoso, detalle) => {
  try {
    await pool.query(
      'INSERT INTO login_logs (email, ip, exitoso, detalle) VALUES ($1, $2, $3, $4)',
      [email, ip, exitoso, detalle]
    )
  } catch (err) {
    console.error('Error registrando log de acceso:', err)
  }
}

const login = async (req, res) => {
  const { email, password } = req.body
  const ip = req.ip || req.headers['x-forwarded-for'] || 'desconocida'

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE',
      [email]
    )

    const usuario = result.rows[0]

    if (!usuario) {
      await registrarLog(email, ip, false, 'Usuario no encontrado')
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash)

    if (!passwordValida) {
      await registrarLog(email, ip, false, 'Contraseña incorrecta')
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    await registrarLog(email, ip, true, 'Login exitoso')

    // Enviar token en cookie httpOnly (más seguro) y también en body (compatibilidad)
    res.cookie('token', token, cookieOpts)
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

const me = async (req, res) => {
  res.json({ usuario: req.usuario })
}

const logout = (req, res) => {
  res.clearCookie('token', { ...cookieOpts, maxAge: 0 })
  res.json({ mensaje: 'Sesión cerrada' })
}

module.exports = { login, me, logout }