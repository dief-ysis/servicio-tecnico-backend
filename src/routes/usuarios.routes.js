const router = require('express').Router()
const { listar, crear, actualizar, cambiarPassword } = require('../controllers/usuarios.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')

router.use(verificarToken)
router.use(requireRol('tecnico'))

router.get('/', listar)
router.post('/', crear)
router.patch('/:id', actualizar)
router.patch('/:id/password', cambiarPassword)

module.exports = router