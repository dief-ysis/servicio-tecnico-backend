const path = require('path')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
const dotenv = require('dotenv')

module.exports = async () => {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true })

  process.env.TEST_PASSWORD = process.env.TEST_PASSWORD || 'test1234'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'
  process.env.DB_HOST = process.env.DB_HOST || 'localhost'
  process.env.DB_PORT = process.env.DB_PORT || '5432'
  process.env.DB_USER = process.env.DB_USER || 'postgres'
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || ''
  process.env.DB_NAME = process.env.DB_NAME || 'servicio_tecnico_test'

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  })

  try {
    const adminEmail = 'admin@taller.com'
    const adminName = 'Administrador'
    const adminRole = 'tecnico'
    const passwordHash = await bcrypt.hash(process.env.TEST_PASSWORD, 10)

    const result = await pool.query('SELECT id FROM usuarios WHERE email = $1', [adminEmail])

    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE usuarios SET password_hash = $1, rol = $2, activo = TRUE WHERE email = $3',
        [passwordHash, adminRole, adminEmail]
      )
    } else {
      await pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [adminName, adminEmail, passwordHash, adminRole]
      )
    }
  } catch (err) {
    console.error('Error en globalSetup:', err)
    throw err
  } finally {
    await pool.end()
  }
}
