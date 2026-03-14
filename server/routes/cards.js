const router = require('express').Router();
const { pool } = require('../db');
const { authRequired, authOptional } = require('../middleware/auth');
const crypto = require('crypto');

// Get card by ID
// Supply info — MUST be before /:id
router.get('/supply/info', async (req, res) => {
  try {
    const supply = await pool.query('SELECT * FROM card_supply ORDER BY effect');
    const minted = await pool.query('SELECT effect, COUNT(*) as minted FROM cosmic_cards GROUP BY effect');
    res.json({ supply: supply.rows, minted: minted.rows });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, u.nickname, u.wallet_address
       FROM cosmic_cards c LEFT JOIN users u ON c.owner_id = u.id
       WHERE c.id = $1`, [req.params.id.toUpperCase()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Card not found' });
    const card = r.rows[0];
    const supply = await pool.query(
      'SELECT total FROM card_supply WHERE effect = $1 AND season = $2',
      [card.effect, card.season]
    );
    res.json({
      id: card.id, effect: card.effect, season: card.season,
      number: card.number, seed: card.seed, rarity: card.rarity,
      owner: card.nickname || null,
      wallet: card.wallet_address || null,
      mintType: card.mint_type, mintPrice: card.mint_price,
      mintedAt: card.minted_at, claimedAt: card.claimed_at,
      totalSupply: supply.rows[0]?.total || 0
    });
  } catch (e) {
    console.error('Card fetch error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List cards by effect or owner
router.get('/', async (req, res) => {
  try {
    const { effect, owner, season } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (effect) { params.push(effect); where += ' AND c.effect = $' + params.length; }
    if (owner) { params.push(owner); where += ' AND u.nickname = $' + params.length; }
    if (season) { params.push(parseInt(season)); where += ' AND c.season = $' + params.length; }
    const r = await pool.query(
      `SELECT c.id, c.effect, c.season, c.number, c.seed, c.rarity,
              u.nickname as owner, c.mint_type, c.minted_at
       FROM cosmic_cards c LEFT JOIN users u ON c.owner_id = u.id
       ${where} ORDER BY c.effect, c.number LIMIT 100`, params
    );
    res.json({ cards: r.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Supply info
router.get('/supply/info', async (req, res) => {
  try {
    const supply = await pool.query('SELECT * FROM card_supply ORDER BY effect');
    const minted = await pool.query(
      `SELECT effect, season, COUNT(*) as minted,
              COUNT(*) FILTER (WHERE owner_id IS NOT NULL) as claimed
       FROM cosmic_cards GROUP BY effect, season`
    );
    res.json({ supply: supply.rows, minted: minted.rows });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Claim card (gameplay unlock)
router.post('/claim', authRequired, async (req, res) => {
  try {
    const { effect } = req.body;
    if (!['star','bolt','ship','void','aura'].includes(effect)) {
      return res.status(400).json({ error: 'Invalid effect' });
    }
    // Check user already has this effect card
    const existing = await pool.query(
      'SELECT id FROM cosmic_cards WHERE owner_id = $1 AND effect = $2 AND mint_type = $3',
      [req.user.id, effect, 'gameplay']
    );
    if (existing.rows.length) return res.status(409).json({ error: 'Already claimed this card' });

    // Check gameplay supply
    const supply = await pool.query(
      'SELECT gameplay FROM card_supply WHERE effect = $1 AND season = 1', [effect]
    );
    const minted = await pool.query(
      "SELECT COUNT(*) as c FROM cosmic_cards WHERE effect = $1 AND season = 1 AND mint_type = 'gameplay'",
      [effect]
    );
    if (parseInt(minted.rows[0].c) >= supply.rows[0].gameplay) {
      return res.status(410).json({ error: 'Gameplay supply exhausted' });
    }

    // Get next number
    const nextNum = await pool.query(
      'SELECT COALESCE(MAX(number),0)+1 as n FROM cosmic_cards WHERE effect = $1 AND season = 1', [effect]
    );
    const num = nextNum.rows[0].n;
    const seed = crypto.randomBytes(8).toString('hex').substring(0, 8);
    const id = effect.toUpperCase() + '-S1-' + String(num).padStart(4, '0');
    const rarity = supply.rows[0] ? (await pool.query('SELECT rarity FROM card_supply WHERE effect=$1 AND season=1',[effect])).rows[0].rarity : 'COMMON';

    await pool.query(
      `INSERT INTO cosmic_cards (id, effect, season, number, seed, rarity, owner_id, mint_type, claimed_at)
       VALUES ($1,$2,1,$3,$4,$5,$6,'gameplay',NOW())`,
      [id, effect, num, seed, rarity, req.user.id]
    );

    res.status(201).json({ id, effect, number: num, seed, rarity });
  } catch (e) {
    console.error('Claim error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
