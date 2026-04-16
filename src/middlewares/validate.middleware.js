/**
 * Middleware factory: valida req.body contra un schema Zod.
 * Si falla, devuelve 400 con los mensajes de error formateados.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    const mensajes = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    return res.status(400).json({ error: mensajes.join(' | ') })
  }
  req.body = result.data // usa los datos ya transformados/coerced por Zod
  next()
}

module.exports = { validate }
