const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://blobi:blobi@localhost:5432/blobileap'
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

module.exports = { pool };
