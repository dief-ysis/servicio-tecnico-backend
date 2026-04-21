const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const cookieParser = require('cookie-parser')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const clientesRoutes = require('./routes/clientes.routes')
const equiposRoutes = require('./routes/equipos.routes')
const usuariosRoutes = require('./routes/usuarios.routes')
const bsaleRoutes = require('./routes/bsale.routes')
const publicRoutes = require('./routes/public.routes')
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
  credentials: true,
  exposedHeaders: ['X-CSRF-Token']
}

app.set('trust proxy', 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors(corsOptions))

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { background-color: #000 } .swagger-ui .topbar-wrapper img { display: none } .swagger-ui .topbar-wrapper::before { content: "LIGHT SOLUTION — API"; color: #ffcd0d; font-weight: 900; font-size: 14px; letter-spacing: 0.08em; }',
    customSiteTitle: 'Light Solution API'
  }))
}

app.use(cookieParser())
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
app.use('/api/auth/login',    loginLimiter)
app.use('/api/v1/auth/login', loginLimiter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando', version: 'v1' })
})

// v1 — rutas con versionado explícito
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/clientes', clientesRoutes)
app.use('/api/v1/equipos', equiposRoutes)
app.use('/api/v1/usuarios', usuariosRoutes)
app.use('/api/v1/bsale', bsaleRoutes)

// Rutas públicas (sin autenticación)
app.use('/api/public', publicRoutes)

// Alias sin versión para compatibilidad hacia atrás (deprecado)
app.use('/api/auth', authRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/equipos', equiposRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/bsale', bsaleRoutes)

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

module.exports = app