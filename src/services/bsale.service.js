const axios = require('axios')

const bsale = axios.create({
  baseURL: 'https://api.bsale.cl/v1',
  headers: {
    'access_token': process.env.BSALE_TOKEN,
    'Content-Type': 'application/json'
  },
  timeout: 10000
})

// Extrae el nombre legible de un cliente BSale
// BSale tiene dos tipos: personas (firstName+lastName) y empresas (company)
const getNombreCliente = (c) => {
  const persona = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return persona || c.company || c.name || `Cliente BSale ${c.id}`
}

// Buscar clientes por texto (nombre, empresa o RUT)
const buscarClientes = async (query) => {
  // BSale usa el parámetro 'name' para buscar por firstName/lastName/company
  // El parámetro 'company' no filtra correctamente y devuelve todos los clientes
  const res = await bsale.get('/clients.json', {
    params: { name: query, limit: 50, state: 0 }
  })
  const items = res.data.items ?? []

  // Filtro client-side para garantizar que los resultados coincidan con la búsqueda
  const q = query.toLowerCase().replace(/[\s\-\.]/g, '')
  return items.filter(c => {
    const nombre = getNombreCliente(c).toLowerCase()
    const rut    = (c.code  ?? '').toLowerCase().replace(/[\s\-\.]/g, '')
    const email  = (c.email ?? '').toLowerCase()
    return nombre.includes(query.toLowerCase()) || rut.includes(q) || email.includes(query.toLowerCase())
  }).slice(0, 15)
}

// Buscar clientes por RUT
const buscarClientesPorRut = async (rut) => {
  const res = await bsale.get('/clients.json', {
    params: { code: rut, limit: 5, state: 0 }
  })
  return res.data.items ?? []
}

// Listar todos los clientes de BSale con paginación
const listarClientes = async (limit = 25, offset = 0, buscar = '') => {
  const params = { limit, offset, state: 0 }
  if (buscar) {
    params.name = buscar
  }
  const res = await bsale.get('/clients.json', { params })
  return {
    items: res.data.items ?? [],
    count: res.data.count ?? 0
  }
}

const obtenerCliente = async (id) => {
  const res = await bsale.get(`/clients/${id}.json`)
  return res.data
}

const crearDocumento = async ({ clienteBsaleId, monto, descripcion, documentTypeId, officeId, priceListId }) => {
  // Obtener datos completos del cliente desde BSale — la API exige nombre, no solo id
  const clienteBsale = await obtenerCliente(clienteBsaleId).catch(() => null)

  // Construir objeto client con todos los campos disponibles
  const clienteBody = { id: clienteBsaleId }
  if (clienteBsale) {
    if (clienteBsale.firstName) clienteBody.firstName = clienteBsale.firstName
    if (clienteBsale.lastName)  clienteBody.lastName  = clienteBsale.lastName
    if (clienteBsale.company)   clienteBody.company   = clienteBsale.company
    if (clienteBsale.code)      clienteBody.code      = clienteBsale.code
    if (clienteBsale.email)     clienteBody.email     = clienteBsale.email
    if (clienteBsale.phone)     clienteBody.phone     = clienteBsale.phone
    // Si no tiene ni nombre ni empresa, poner algo para no romper BSale
    if (!clienteBsale.firstName && !clienteBsale.lastName && !clienteBsale.company) {
      clienteBody.company = clienteBsale.name ?? `Cliente ${clienteBsaleId}`
    }
  }

  const body = {
    documentTypeId: documentTypeId  ?? parseInt(process.env.BSALE_DOCUMENT_TYPE_ID ?? '0'),
    officeId:       officeId        ?? parseInt(process.env.BSALE_OFFICE_ID        ?? '0'),
    priceListId:    priceListId     ?? parseInt(process.env.BSALE_PRICE_LIST_ID    ?? '1'),
    emissionDate:   Math.floor(Date.now() / 1000),
    expirationDate: Math.floor(Date.now() / 1000),
    declare: 1,
    client: clienteBody,
    details: [
      {
        quantity: 1,
        // BSale trabaja con valores netos (sin IVA). El monto ingresado es el total con IVA.
        netUnitValue: Math.round(monto / 1.19),
        comment: descripcion,
        discount: 0,
        taxId: '[1]'
      }
    ],
    payments: []
  }
  console.log('[bsale] crearDocumento body:', JSON.stringify(body))
  try {
    const res = await bsale.post('/documents.json', body)
    return res.data
  } catch (err) {
    console.error('[bsale] error al crear documento:',
      JSON.stringify(err.response?.data ?? err.message))
    throw err
  }
}

const obtenerTiposDocumento = async () => {
  const res = await bsale.get('/document_types.json', {
    params: { state: 0, limit: 20 }
  })
  return res.data.items ?? []
}

const obtenerOficinas = async () => {
  const res = await bsale.get('/offices.json', {
    params: { state: 0 }
  })
  return res.data.items ?? []
}

const obtenerListasPrecios = async () => {
  const res = await bsale.get('/price_lists.json', {
    params: { state: 0, limit: 20 }
  })
  return res.data.items ?? []
}

module.exports = {
  buscarClientes,
  buscarClientesPorRut,
  listarClientes,
  obtenerCliente,
  getNombreCliente,
  crearDocumento,
  obtenerTiposDocumento,
  obtenerOficinas,
  obtenerListasPrecios
}
