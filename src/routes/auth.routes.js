const router = require('express').Router()
const { login, me } = require('../controllers/auth.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const pool = require('../db/connection')

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@taller.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login exitoso, retorna JWT
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login)

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener usuario autenticado
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Datos del usuario del token
 *       401:
 *         description: Token inválido o expirado
 */
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