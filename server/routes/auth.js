const router = require('express').Router();
const { pool } = require('../db');
const jwt = require('jsonwebtoken');
const notify = require('../notify');

router.post('/nickname', async (req, res) => {
  try {
    let { nickname } = req.body;
    if (!nickname || nickname.length < 2 || nickname.length > 20) return res.status(400).json({ error: 'Invalid nickname' });
    nickname = nickname.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (nickname.length < 2) return res.status(400).json({ error: 'Invalid characters' });
    nickname = nickname.charAt(0).toUpperCase() + nickname.slice(1);
    const exists = await pool.query('SELECT id FROM users WHERE LOWER(nickname) = LOWER($1)', [nickname]);
    if (exists.rows.length) return res.status(409).json({ error: 'Nickname taken' });
    const r = await pool.query('INSERT INTO users (nickname, best_score, total_games) VALUES ($1, 0, 0) RETURNING *', [nickname]);
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, process.env.JWT_SECRET, { expiresIn: '365d' });
    notify.newPlayer(user.nickname, req.headers['user-agent']);
    res.status(201).json({ token, user: { id: user.id, nickname: user.nickname, wallet: user.wallet_address } });
  } catch (e) { console.error('Auth error:', e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/recover', async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey || !publicKey.startsWith('G') || publicKey.length !== 56) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const r = await pool.query('SELECT * FROM users WHERE wallet_address = $1', [publicKey]);
    if (!r.rows.length) return res.status(404).json({ error: 'No account linked to this wallet' });
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, nickname: user.nickname }, process.env.JWT_SECRET, { expiresIn: '365d' });
    res.json({ token, user: { id: user.id, nickname: user.nickname, wallet: user.wallet_address, best_score: user.best_score } });
  } catch (e) { console.error('Recover error:', e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET);
    const r = await pool.query('SELECT id, nickname, wallet_address, best_score, total_games FROM users WHERE id = $1', [decoded.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: r.rows[0] });
  } catch (e) { res.status(401).json({ error: 'Invalid token' }); }
});

module.exports = router;
