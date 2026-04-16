const router = require('express').Router()
const { login, me, logout } = require('../controllers/auth.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { loginSchema } = require('../schemas')
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
 *                 example: usuario@empresa.cl
 *               password:
 *                 type: string
 *                 example: "tu_contraseña"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna JWT
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', validate(loginSchema), login)

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

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión (invalida cookie)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada
 */
router.post('/logout', verificarToken, logout)

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