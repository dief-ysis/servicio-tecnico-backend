const router = require('express').Router()
const { login, me } = require('../controllers/auth.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const pool = require('../db/connection')

router.post('/login', login)
router.get('/me', verificarToken, me)

router.get('/logs', verificarToken, requireRol('tecnico'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM login_logs ORDER BY creado_en DESC LIMIT 100'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

module.exports = router