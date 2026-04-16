const jwt = require('jsonwebtoken')

const verificarToken = (req, res, next) => {
  // Acepta token desde cookie httpOnly (preferido) o Authorization header (legacy)
  const authHeader = req.headers['authorization']
  const token = req.cookies?.token ?? (authHeader && authHeader.split(' ')[1])

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = payload
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada' })
    }
    return res.status(401).json({ error: 'Token inválido' })
  }
}

const requireRol = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' })
    }
    next()
  }
}

module.exports = { verificarToken, requireRol }