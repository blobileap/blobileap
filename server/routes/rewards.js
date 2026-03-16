const router = require('express').Router();
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

// Get user's BLOBI balance (from Stellar)
router.get('/balance/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const fetch = (await import('node-fetch')).default;
    const r = await fetch('https://horizon.stellar.org/accounts/' + wallet);
    if (!r.ok) return res.json({ balance: '0' });
    const data = await r.json();
    const blobi = data.balances.find(b => b.asset_code === 'BLOBI' && b.asset_issuer === 'GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI');
    res.json({ balance: blobi ? blobi.balance : '0' });
  } catch (e) {
    res.json({ balance: '0' });
  }
});

// Get reward info
router.get('/info', async (req, res) => {
  try {
    const weekly = await pool.query(
      `SELECT u.nickname, u.wallet_address, MAX(s.score) as best
       FROM scores s JOIN users u ON s.user_id = u.id
       WHERE s.created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '1 day'
       AND u.wallet_address IS NOT NULL
       GROUP BY u.id ORDER BY best DESC LIMIT 10`
    );
    res.json({
      weeklyPool: 1000,
      token: 'BLOBI',
      issuer: 'GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI',
      topPlayers: weekly.rows
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});
// Build unsigned changeTrust XDR for BLOBI
router.post('/trustline-xdr', async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ error: 'Missing publicKey' });
    const StellarSdk = require('@stellar/stellar-sdk');
    const server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
    const account = await server.loadAccount(publicKey);
    const blobi = new StellarSdk.Asset('BLOBI', 'GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI');
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.PUBLIC
    })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: blobi }))
    .setTimeout(120)
    .build();
    res.json({ xdr: tx.toXDR() });
  } catch (e) {
    console.error('Trustline XDR error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// Reward history for a user
router.get('/history/:nickname', async (req, res) => {
  try {
    const nick = req.params.nickname;
    const u = await pool.query('SELECT id FROM users WHERE LOWER(nickname) = LOWER($1)', [nick]);
    if (!u.rows.length) return res.json({ rewards: [] });
    const r = await pool.query(
      'SELECT week_start, rank, amount, tx_hash, created_at FROM reward_history WHERE user_id = $1 ORDER BY week_start DESC LIMIT 20',
      [u.rows[0].id]
    );
    res.json({ rewards: r.rows });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Public reward history (all users)
router.get('/history', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT rh.week_start, rh.rank, rh.amount, rh.tx_hash, u.nickname FROM reward_history rh JOIN users u ON rh.user_id = u.id WHERE rh.week_start >= (SELECT COALESCE(MAX(week_start), NOW()) FROM reward_history) - INTERVAL \'7 days\' ORDER BY rh.week_start DESC, rh.rank ASC'
    );
    const stats = await pool.query(
      'SELECT COUNT(*) as total_rewards, COALESCE(SUM(amount),0) as total_blobi, COUNT(DISTINCT week_start) as total_weeks, COUNT(DISTINCT user_id) as total_players FROM reward_history'
    );
    res.json({ rewards: r.rows, stats: stats.rows[0] });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});
