require('dotenv').config({ path: '/var/www/blobileap/.env' });
const { pool } = require('../db');

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(20) UNIQUE NOT NULL,
    wallet_address VARCHAR(56) UNIQUE,
    best_score INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    speed REAL NOT NULL DEFAULT 1.0,
    near_miss INTEGER DEFAULT 0,
    best_combo INTEGER DEFAULT 0,
    survival_time INTEGER DEFAULT 0,
    total_leaps INTEGER DEFAULT 0,
    saw_star BOOLEAN DEFAULT FALSE,
    saw_lightning BOOLEAN DEFAULT FALSE,
    saw_rocket BOOLEAN DEFAULT FALSE,
    saw_blackhole BOOLEAN DEFAULT FALSE,
    saw_aurora BOOLEAN DEFAULT FALSE,
    replay_hash VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_scores_created ON scores(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_users_best ON users(best_score DESC)`
];

async function run() {
  console.log('Running migrations...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('OK:', sql.substring(0, 60) + '...');
    } catch (e) {
      console.error('FAIL:', e.message);
    }
  }
  console.log('Migrations complete.');
  await pool.end();
}

run();
