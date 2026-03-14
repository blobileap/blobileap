require('dotenv').config({ path: '/var/www/blobileap/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const scoreRoutes = require('./routes/scores');
const leaderboardRoutes = require('./routes/leaderboard');
const walletRoutes = require('./routes/wallet');
const cardRoutes = require('./routes/cards');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '100kb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/cards', cardRoutes);

// Serve card verify page
app.get('/card/:id', (req, res) => {
  res.sendFile('/var/www/blobileap/client/public/card/index.html');
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Serve static game files (Nginx handles this in production)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../client/public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Blobi Leap server running on port ${PORT}`);
});
