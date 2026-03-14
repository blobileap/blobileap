const StellarSdk = require('@stellar/stellar-sdk');
const { pool } = require('./db');

const ISSUER = 'GDSM5FTQQQDCM5AU6B5FICSCO65IPY5V2KE4TBC6PSWCDGBP3V2BLOBI';
const BLOBI = new StellarSdk.Asset('BLOBI', ISSUER);
const server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');

const REWARDS = [300, 200, 150, 100, 100, 50, 50, 50, 50, 50];

async function getWeeklyTop() {
  const r = await pool.query(
    'SELECT u.id, u.nickname, u.wallet_address, MAX(s.score) as best FROM scores s JOIN users u ON s.user_id = u.id WHERE s.created_at > NOW() - INTERVAL \'7 days\' AND u.wallet_address IS NOT NULL GROUP BY u.id ORDER BY best DESC'
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
  const top = await getWeeklyTop();
  const balance = await getHotBalance();
  const eligible = [];
  const skipped = [];

  for (const player of top) {
    const hasTL = await checkTrustline(player.wallet_address);
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

  const totalNeeded = eligible.reduce(function(sum, p) { return sum + p.amount; }, 0);
  return { eligible, skipped, totalNeeded, hotBalance: balance };
}

async function sendRewards() {
  const hotSecret = process.env.HOT_WALLET_SECRET;
  if (!hotSecret) throw new Error('HOT_WALLET_SECRET not set');

  const hotKeypair = StellarSdk.Keypair.fromSecret(hotSecret);
  const top = await getWeeklyTop();
  const results = [];
  let rewardIdx = 0;

  for (const player of top) {
    if (rewardIdx >= 10) break;
    const hasTL = await checkTrustline(player.wallet_address);
    if (!hasTL) {
      results.push({ nickname: player.nickname, score: player.best, amount: 0, status: 'skipped (no trustline)' });
      continue;
    }

    var amount = String(REWARDS[rewardIdx]);
    try {
      var hotAccount = await server.loadAccount(process.env.HOT_WALLET_PUBLIC);
      var tx = new StellarSdk.TransactionBuilder(hotAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.PUBLIC
      })
      .addOperation(StellarSdk.Operation.payment({
        destination: player.wallet_address,
        asset: BLOBI,
        amount: amount
      }))
      .setTimeout(60)
      .build();

      tx.sign(hotKeypair);
      var submitResult = await server.submitTransaction(tx);
      results.push({ nickname: player.nickname, rank: rewardIdx + 1, amount: amount, status: 'sent', tx: submitResult.hash });
      rewardIdx++;
    } catch (e) {
      var errMsg = e.response && e.response.data && e.response.data.extras ? JSON.stringify(e.response.data.extras.result_codes) : e.message;
      results.push({ nickname: player.nickname, amount: amount, status: 'failed: ' + errMsg });
      rewardIdx++;
    }
  }

  return results;
}

module.exports = { previewRewards, sendRewards, getHotBalance };
