const router = require('express').Router()
const { listar, obtener, crear, actualizar, cambiarEstado, historial } = require('../controllers/equipos.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')

router.use(verificarToken)

/**
 * @swagger
 * /equipos:
 *   get:
 *     summary: Listar equipos
 *     tags: [Equipos]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [por_reparar, en_reparacion, reparado, irreparable, entregado]
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lista de equipos con datos del cliente
 */
router.get('/', listar)
router.get('/:id', obtener)
router.get('/:id/historial', historial)
router.post('/', requireRol('recepcionista', 'tecnico'), crear)
router.patch('/:id', requireRol('tecnico'), actualizar)

/**
 * @swagger
 * /equipos/{id}/estado:
 *   patch:
 *     summary: Cambiar estado de un equipo
 *     tags: [Equipos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [por_reparar, en_reparacion, reparado, irreparable, entregado]
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Estado inválido
 */
router.patch('/:id/estado', requireRol('tecnico'), cambiarEstado)

module.exports = router