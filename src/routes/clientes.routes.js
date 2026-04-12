const router = require('express').Router()
const { listar, obtener, crear, actualizar } = require('../controllers/clientes.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/', listar)
router.get('/:id', obtener)
router.post('/', requireRol('recepcionista', 'tecnico'), crear)
router.patch('/:id', requireRol('recepcionista', 'tecnico'), actualizar)

module.exports = router