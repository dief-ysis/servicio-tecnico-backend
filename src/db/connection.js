const { Pool } = require('pg')
require('dotenv').config()

if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: '.env.test', override: true })
} else {
  require('dotenv').config()
}

// Soporte para DATABASE_URL (Render, Neon, Railway, Heroku)
// o variables individuales para desarrollo local con PostgreSQL local
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: false
    }

const pool = new Pool({
  ...poolConfig,
  max:                  parseInt(process.env.DB_POOL_MAX ?? '5'),
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 3_000
})

pool.on('connect', () => console.log('Conectado a PostgreSQL'))
pool.on('error', (err) => { console.error('Error PostgreSQL:', err); process.exit(1) })

module.exports = pool