const router = require('express').Router()
const { listar, crear, actualizar, cambiarPassword } = require('../controllers/usuarios.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { crearUsuarioSchema, actualizarUsuarioSchema, cambiarPasswordSchema } = require('../schemas')

router.use(verificarToken)
router.use(requireRol('tecnico'))

router.get('/', listar)
router.post('/', validate(crearUsuarioSchema), crear)
router.patch('/:id', validate(actualizarUsuarioSchema), actualizar)
router.patch('/:id/password', validate(cambiarPasswordSchema), cambiarPassword)

module.exports = router