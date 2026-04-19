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

// Buscar clientes por texto (nombre o empresa)
const buscarClientes = async (query) => {
  // BSale busca por firstName/lastName con 'name', y por empresa con 'company'
  // Hacemos dos búsquedas en paralelo y combinamos resultados únicos
  const [porNombre, porEmpresa] = await Promise.all([
    bsale.get('/clients.json', {
      params: { name: query, limit: 8, state: 0 }
    }).then(r => r.data.items ?? []).catch(() => []),
    bsale.get('/clients.json', {
      params: { company: query, limit: 8, state: 0 }
    }).then(r => r.data.items ?? []).catch(() => [])
  ])

  // Combinar y deduplicar por id
  const mapa = new Map()
  for (const c of [...porNombre, ...porEmpresa]) {
    if (!mapa.has(c.id)) mapa.set(c.id, c)
  }
  return Array.from(mapa.values()).slice(0, 10)
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

const crearDocumento = async ({ clienteBsaleId, monto, descripcion }) => {
  const body = {
    documentTypeId: parseInt(process.env.BSALE_DOCUMENT_TYPE_ID ?? '1'),
    officeId:       parseInt(process.env.BSALE_OFFICE_ID        ?? '1'),
    priceListId:    parseInt(process.env.BSALE_PRICE_LIST_ID    ?? '1'),
    emissionDate:   Math.floor(Date.now() / 1000),
    expirationDate: Math.floor(Date.now() / 1000),
    declare: 1,
    clientId: clienteBsaleId,
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
  const res = await bsale.post('/documents.json', body)
  return res.data
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

module.exports = {
  buscarClientes,
  buscarClientesPorRut,
  listarClientes,
  obtenerCliente,
  getNombreCliente,
  crearDocumento,
  obtenerTiposDocumento,
  obtenerOficinas
}
