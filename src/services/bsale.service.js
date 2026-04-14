const axios = require('axios')

const bsale = axios.create({
  baseURL: 'https://api.bsale.cl/v1',
  headers: {
    'access_token': process.env.BSALE_TOKEN,
    'Content-Type': 'application/json'
  },
  timeout: 8000
})

const buscarClientes = async (query) => {
  const res = await bsale.get('/clients.json', {
    params: {
      fields: 'id,firstName,lastName,email,phone,code,company',
      name: query,
      limit: 8,
      state: 1
    }
  })
  return res.data.items ?? []
}

const buscarClientesPorRut = async (rut) => {
  const res = await bsale.get('/clients.json', {
    params: {
      fields: 'id,firstName,lastName,email,phone,code,company',
      code: rut,
      limit: 5,
      state: 1
    }
  })
  return res.data.items ?? []
}

const obtenerCliente = async (id) => {
  const res = await bsale.get(`/clients/${id}.json`)
  return res.data
}

const crearDocumento = async ({ clienteBsaleId, monto, descripcion }) => {
  const body = {
    documentTypeId: 1,
    officeId: 1,
    priceListId: 1,
    emissionDate: Math.floor(Date.now() / 1000),
    expirationDate: Math.floor(Date.now() / 1000),
    declare: 1,
    clientId: clienteBsaleId,
    details: [
      {
        quantity: 1,
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
  obtenerCliente,
  crearDocumento,
  obtenerTiposDocumento,
  obtenerOficinas
}