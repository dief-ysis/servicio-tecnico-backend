afterAll(async () => {
  const pool = require('../db/connection')
  await pool.end()
})