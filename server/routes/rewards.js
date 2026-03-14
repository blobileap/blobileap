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
       WHERE s.created_at > NOW() - INTERVAL '7 days'
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
