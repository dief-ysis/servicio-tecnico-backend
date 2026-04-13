const pool = require('../db/connection')

const router = require('express').Router()
const { listar, obtener, crear, actualizar } = require('../controllers/clientes.controller')
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/', listar)
router.get('/:id', obtener)
router.post('/', requireRol('recepcionista', 'tecnico'), crear)
router.patch('/:id', requireRol('recepcionista', 'tecnico'), actualizar)
router.delete('/:id', verificarToken, requireRol('tecnico'), async (req, res) => {
  const { id } = req.params
  try {
    await pool.query(
      'UPDATE clientes SET activo = FALSE, eliminado_en = NOW() WHERE id = $1',
      [id]
    )
    res.json({ mensaje: 'Datos del cliente eliminados correctamente' })
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

module.exports = router