const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const clientesRoutes = require('./routes/clientes.routes')
const equiposRoutes = require('./routes/equipos.routes')
const usuariosRoutes = require('./routes/usuarios.routes')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./swagger')

const app = express()

const corsOptions = {
  origin: (origin, callback) => {
    const permitidos = [
      'https://servicio-tecnico-frontend.vercel.app',
      'http://localhost:5173'
    ]
    if (!origin || permitidos.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(new Error('No permitido por CORS'))
    }
  },
  credentials: true
}

app.set('trust proxy', 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors(corsOptions))

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { background-color: #000 } .swagger-ui .topbar-wrapper img { display: none } .swagger-ui .topbar-wrapper::before { content: "LIGHT SOLUTION — API"; color: #ffcd0d; font-weight: 900; font-size: 14px; letter-spacing: 0.08em; }',
  customSiteTitle: 'Light Solution API'
}))

app.use(express.json({ limit: '10kb' }))

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Espera 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', globalLimiter)
app.use('/api/auth/login', loginLimiter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando' })
})

app.use('/api/auth', authRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/equipos', equiposRoutes)
app.use('/api/usuarios', usuariosRoutes)

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const bsaleRoutes = require('./routes/bsale.routes')
app.use('/api/bsale', bsaleRoutes)

module.exports = app