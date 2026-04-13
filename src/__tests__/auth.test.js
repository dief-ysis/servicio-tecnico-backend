const request = require('supertest')
const app = require('../app')

describe('POST /api/auth/login', () => {
  it('retorna 400 si faltan credenciales', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('retorna 401 con credenciales inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.com', password: 'wrongpass' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Credenciales inválidas')
  })

  it('retorna 401 con contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@taller.com', password: 'passwordmala' })
    expect(res.status).toBe(401)
  })

  it('retorna 200 y token con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@taller.com', password: process.env.TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.usuario.rol).toBe('tecnico')
  })
})

describe('GET /api/auth/me', () => {
  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('retorna usuario con token válido', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@taller.com', password: process.env.TEST_PASSWORD })

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
    expect(res.status).toBe(200)
    expect(res.body.usuario.id).toBeDefined()
  })
})