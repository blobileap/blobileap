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

router.get('/profile/:nickname', async (req, res) => {
  try {
    const nick = req.params.nickname;
    const u = await pool.query('SELECT id, nickname, wallet_address, best_score, total_games, created_at FROM users WHERE LOWER(nickname) = LOWER($1)', [nick]);
    if (!u.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = u.rows[0];
    const cards = await pool.query('SELECT id, effect, season, number, seed, rarity, claimed_at FROM cosmic_cards WHERE owner_id = $1 ORDER BY claimed_at DESC', [user.id]);
    var blobiBal = 0;
    if (user.wallet_address) {
      try {
        const fetch = (await import('node-fetch')).default;
        const r = await fetch('https://horizon.stellar.org/accounts/' + user.wallet_address);
        if (r.ok) {
          const acc = await r.json();
          const b = acc.balances.find(x => x.asset_code === 'BLOBI' && x.asset_issuer === 'GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI');
          if (b) blobiBal = parseFloat(b.balance);
        }
      } catch (e) {}
    }
    res.json({
      nickname: user.nickname,
      wallet: user.wallet_address,
      bestScore: user.best_score,
      totalGames: user.total_games,
      joinedAt: user.created_at,
      blobiBal: blobiBal,
      cards: cards.rows
    });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});
