const router = require('express').Router()
const { verificarToken, requireRol } = require('../middlewares/auth.middleware')
const {
  buscarClientes,
  buscarClientesPorRut,
  listarClientes,
  getNombreCliente,
  crearDocumento,
  obtenerTiposDocumento,
  obtenerOficinas
} = require('../services/bsale.service')
const pool = require('../db/connection')

// Buscar clientes BSale por nombre o RUT
router.get('/clientes', verificarToken, async (req, res) => {
  const { q, rut } = req.query
  if (!q && !rut) {
    return res.status(400).json({ error: 'Ingresa un nombre o RUT' })
  }
  try {
    const clientes = rut
      ? await buscarClientesPorRut(rut)
      : await buscarClientes(q)

    // Normalizar respuesta para que siempre tenga campo 'nombre' legible
    const resultado = clientes.map(c => ({
      ...c,
      nombre: getNombreCliente(c)
    }))
    res.json(resultado)
  } catch (err) {
    console.error('Bsale error:', err.response?.data ?? err.message)
    res.status(502).json({ error: 'Error al conectar con Bsale' })
  }
})

// Listar todos los clientes de BSale con paginación / búsqueda
router.get('/clientes/lista', verificarToken, async (req, res) => {
  const limite = Math.min(parseInt(req.query.limite) || 25, 50)
  const offset  = Math.max(parseInt(req.query.offset) || 0, 0)
  const buscar  = (req.query.buscar ?? '').trim()

  try {
    let items, count

    if (buscar) {
      // Búsqueda activa: usar función dual (name + company) para encontrar personas y empresas
      items = await buscarClientes(buscar)
      count = items.length
    } else {
      // Listado sin filtro: paginación normal
      const result = await listarClientes(limite, offset, '')
      items = result.items
      count = result.count
    }
    // Enriquecer con nombre legible y equipos locales si los hay
    const bsaleIds = items.map(c => c.id).filter(Boolean)

    let equiposPorBsale = {}
    if (bsaleIds.length > 0) {
      const r = await pool.query(
        `SELECT c.bsale_id, COUNT(e.id) AS total
         FROM clientes c
         LEFT JOIN equipos e ON e.cliente_id = c.id
         WHERE c.bsale_id = ANY($1::int[])
         GROUP BY c.bsale_id`,
        [bsaleIds]
      )
      for (const row of r.rows) {
        equiposPorBsale[row.bsale_id] = parseInt(row.total)
      }
    }

    const resultado = items.map(c => ({
      ...c,
      nombre: getNombreCliente(c),
      total_equipos: equiposPorBsale[c.id] ?? 0
    }))

    res.json({ data: resultado, total: count, offset, limite })
  } catch (err) {
    console.error('Bsale lista error:', err.response?.data ?? err.message)
    res.status(502).json({ error: 'Error al obtener clientes de Bsale' })
  }
})

// Obtener equipos locales de un cliente BSale por su bsale_id
router.get('/clientes/:bsale_id/equipos', verificarToken, async (req, res) => {
  const { bsale_id } = req.params
  try {
    const r = await pool.query(
      `SELECT e.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
       FROM equipos e
       JOIN clientes c ON e.cliente_id = c.id
       WHERE c.bsale_id = $1
       ORDER BY e.fecha_ingreso DESC`,
      [parseInt(bsale_id)]
    )
    res.json(r.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Generar documento en BSale
router.post('/documento', verificarToken, requireRol('tecnico'), async (req, res) => {
  const { equipoId, clienteBsaleId, monto, descripcion } = req.body

  if (!equipoId || !clienteBsaleId || !monto || !descripcion) {
    return res.status(400).json({
      error: `Faltan campos requeridos: ${[
        !equipoId && 'equipoId',
        !clienteBsaleId && 'clienteBsaleId (el cliente debe estar vinculado a Bsale)',
        !monto && 'monto',
        !descripcion && 'descripcion'
      ].filter(Boolean).join(', ')}`
    })
  }

  try {
    const doc = await crearDocumento({ clienteBsaleId, monto, descripcion })

    await pool.query(
      `INSERT INTO historial_cambios (equipo_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo)
       VALUES ($1, $2, 'documento_bsale', NULL, $3)`,
      [equipoId, req.usuario.id, `N°${doc.number}`]
    )

    try {
      await pool.query(
        `UPDATE equipos SET bsale_documento_id = $1, bsale_documento_url = $2 WHERE id = $3`,
        [doc.number ?? doc.id, doc.urlPdf ?? null, equipoId]
      )
    } catch (trackingErr) {
      console.warn('[bsale] columnas de tracking no encontradas:', trackingErr.message)
    }

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

// Configuración de BSale (tipos de documento y oficinas)
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
