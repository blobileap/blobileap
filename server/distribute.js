const StellarSdk = require('@stellar/stellar-sdk');
const { pool } = require('./db');

const ISSUER = 'GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI';
const BLOBI = new StellarSdk.Asset('BLOBI', ISSUER);
const server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');

const REWARDS = [300, 200, 150, 100, 100, 50, 50, 50, 50, 50];

const CURRENT_WEEK_SQL = "s.created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '1 day'";
const LAST_WEEK_SQL = "s.created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '8 days' AND s.created_at < DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '1 day'";

async function getTop(weekFilter) {
  const r = await pool.query(
    'SELECT u.id, u.nickname, u.wallet_address, MAX(s.score) as best FROM scores s JOIN users u ON s.user_id = u.id WHERE ' + weekFilter + ' AND u.wallet_address IS NOT NULL GROUP BY u.id ORDER BY best DESC'
  );
  return r.rows;
}

async function checkTrustline(wallet) {
  try {
    const acc = await server.loadAccount(wallet);
    return acc.balances.some(b => b.asset_code === 'BLOBI' && b.asset_issuer === ISSUER);
  } catch (e) { return false; }
}

async function getHotBalance() {
  try {
    const acc = await server.loadAccount(process.env.HOT_WALLET_PUBLIC);
    const b = acc.balances.find(x => x.asset_code === 'BLOBI' && x.asset_issuer === ISSUER);
    return b ? parseFloat(b.balance) : 0;
  } catch (e) { return 0; }
}

async function previewRewards() {
  var top = await getTop(CURRENT_WEEK_SQL);
  var balance = await getHotBalance();
  var eligible = [];
  var skipped = [];

  for (var i = 0; i < top.length; i++) {
    var player = top[i];
    var hasTL = await checkTrustline(player.wallet_address);
    if (hasTL && eligible.length < 10) {
      eligible.push({
        rank: eligible.length + 1,
        nickname: player.nickname,
        wallet: player.wallet_address.substring(0, 4) + '...' + player.wallet_address.slice(-4),
        score: player.best,
        amount: REWARDS[eligible.length],
        status: 'ready'
      });
    } else {
      skipped.push({
        nickname: player.nickname,
        score: player.best,
        reason: !hasTL ? 'no trustline' : 'outside top 10 eligible'
      });
    }
  }

  var totalNeeded = eligible.reduce(function(sum, p) { return sum + p.amount; }, 0);
  return { eligible: eligible, skipped: skipped, totalNeeded: totalNeeded, hotBalance: balance };
}

async function sendRewards() {
  var hotSecret = process.env.HOT_WALLET_SECRET;
  if (!hotSecret) throw new Error('HOT_WALLET_SECRET not set');

  var hotKeypair = StellarSdk.Keypair.fromSecret(hotSecret);
  var top = await getTop(LAST_WEEK_SQL);
  var eligible = [];
  var skipped = [];
  var rewardIdx = 0;

  for (var i = 0; i < top.length; i++) {
    if (rewardIdx >= 10) break;
    var player = top[i];
    var hasTL = await checkTrustline(player.wallet_address);
    if (!hasTL) {
      skipped.push({ nickname: player.nickname, score: player.best, reason: 'no trustline' });
      continue;
    }
    eligible.push({ id: player.id, nickname: player.nickname, wallet: player.wallet_address, amount: String(REWARDS[rewardIdx]), rank: rewardIdx + 1 });
    rewardIdx++;
  }

  if (eligible.length === 0) return { results: [], skipped: skipped, txHash: null };

  try {
    var hotAccount = await server.loadAccount(process.env.HOT_WALLET_PUBLIC);
    var builder = new StellarSdk.TransactionBuilder(hotAccount, {
      fee: String(100 * eligible.length),
      networkPassphrase: StellarSdk.Networks.PUBLIC
    });

    eligible.forEach(function(p) {
      builder.addOperation(StellarSdk.Operation.payment({
        destination: p.wallet,
        asset: BLOBI,
        amount: p.amount
      }));
    });

    var tx = builder.setTimeout(120).build();
    tx.sign(hotKeypair);
    var submitResult = await server.submitTransaction(tx);
    var txHash = submitResult.hash;

    // Save all to history
    for (var j = 0; j < eligible.length; j++) {
      try {
        await pool.query(
          "INSERT INTO reward_history (user_id, week_start, rank, amount, tx_hash) VALUES ($1, DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '8 days', $2, $3, $4)",
          [eligible[j].id, eligible[j].rank, parseInt(eligible[j].amount), txHash]
        );
      } catch(e) { console.warn('History save error:', e.message); }
    }

    var results = eligible.map(function(p) {
      return { nickname: p.nickname, rank: p.rank, amount: p.amount, status: 'sent' };
    });

    return { results: results, skipped: skipped, txHash: txHash };

  } catch (e) {
    var errMsg = e.response && e.response.data && e.response.data.extras ? JSON.stringify(e.response.data.extras.result_codes) : e.message;
    return { results: eligible.map(function(p) { return { nickname: p.nickname, amount: p.amount, status: 'failed: ' + errMsg }; }), skipped: skipped, txHash: null };
  }
}

module.exports = { previewRewards, sendRewards, getHotBalance };
