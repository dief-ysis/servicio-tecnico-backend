const router = require('express').Router()
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const {
  buscarClientes,
  buscarClientesPorRut,
  crearDocumento,
  obtenerTiposDocumento,
  obtenerOficinas
} = require('../services/bsale.service')
const pool = require('../db/connection')

router.get('/clientes', verificarToken, async (req, res) => {
  const { q, rut } = req.query
  if (!q && !rut) {
    return res.status(400).json({ error: 'Ingresa un nombre o RUT' })
  }
  try {
    const clientes = rut
      ? await buscarClientesPorRut(rut)
      : await buscarClientes(q)
    res.json(clientes)
  } catch (err) {
    console.error('Bsale error:', err.response?.data ?? err.message)
    res.status(502).json({ error: 'Error al conectar con Bsale' })
  }
})

router.post('/documento', verificarToken, requireRol('tecnico'), async (req, res) => {
  const { equipoId, clienteBsaleId, monto, descripcion } = req.body

  if (!equipoId || !clienteBsaleId || !monto || !descripcion) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }

  try {
    const doc = await crearDocumento({ clienteBsaleId, monto, descripcion })

    await pool.query(
      `UPDATE equipos SET observaciones = COALESCE(observaciones || E'\n', '') || $1 WHERE id = $2`,
      [`Documento Bsale generado: N°${doc.number} - $${monto.toLocaleString('es-CL')}`, equipoId]
    )

    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'documento_bsale', NULL, $3)`,
      [equipoId, req.usuario.id, `N°${doc.number}`]
    )

    res.json({
      numero: doc.number,
      urlPdf: doc.urlPdf,
      total: monto
    })
  } catch (err) {
    console.error('Bsale error:', err.response?.data ?? err.message)
    res.status(502).json({ error: 'Error al generar documento en Bsale' })
  }
})

router.get('/config', verificarToken, requireRol('tecnico'), async (req, res) => {
  try {
    const [tipos, oficinas] = await Promise.all([
      obtenerTiposDocumento(),
      obtenerOficinas()
    ])
    res.json({ tipos, oficinas })
  } catch (err) {
    res.status(502).json({ error: 'Error al obtener configuración de Bsale' })
  }
})

module.exports = router