const router = require('express').Router()
const { listar, obtener, crear, actualizar, cambiarEstado, historial } = require('../controllers/equipos.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/', listar)
router.get('/:id', obtener)
router.get('/:id/historial', historial)
router.post('/', requireRol('recepcionista', 'tecnico'), crear)
router.patch('/:id', requireRol('tecnico'), actualizar)
router.patch('/:id/estado', requireRol('tecnico'), cambiarEstado)

module.exports = router