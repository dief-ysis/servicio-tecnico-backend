const request = require('supertest')
const app = require('../app')

let token
let clienteId
let equipoId

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@taller.com', password: process.env.TEST_PASSWORD })
  token = res.body.token

  const clienteRes = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Cliente Test', telefono: '912345678' })
  clienteId = clienteRes.body.id
})

describe('GET /api/equipos', () => {
  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/equipos')
    expect(res.status).toBe(401)
  })

  it('retorna lista de equipos', async () => {
    const res = await request(app)
      .get('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('filtra por estado', async () => {
    const res = await request(app)
      .get('/api/equipos?estado=por_reparar')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    res.body.forEach(eq => {
      expect(eq.estado_actual).toBe('por_reparar')
    })
  })
})

describe('POST /api/equipos', () => {
  it('retorna 400 sin tipo_equipo', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId })
    expect(res.status).toBe(400)
  })

  it('crea equipo correctamente', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cliente_id: clienteId,
        tipo_equipo: 'parled',
        marca: 'Chauvet',
        modelo: 'SlimPAR',
        falla_reportada: 'No enciende'
      })
    expect(res.status).toBe(201)
    expect(res.body.numero_ingreso).toMatch(/^ST-/)
    expect(res.body.estado_actual).toBe('por_reparar')
    equipoId = res.body.id
  })
})

describe('PATCH /api/equipos/:id/estado', () => {
  it('retorna 400 con estado inválido', async () => {
    const res = await request(app)
      .patch(`/api/equipos/${equipoId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'inventado' })
    expect(res.status).toBe(400)
  })

  it('cambia estado correctamente', async () => {
    const res = await request(app)
      .patch(`/api/equipos/${equipoId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'en_reparacion' })
    expect(res.status).toBe(200)
    expect(res.body.estado_actual).toBe('en_reparacion')
  })
})

describe('GET /api/equipos/:id/historial', () => {
  it('retorna historial del equipo', async () => {
    const res = await request(app)
      .get(`/api/equipos/${equipoId}/historial`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })
})