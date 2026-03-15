require('dotenv').config({ path: '/var/www/blobileap/.env' });
const https = require('https');
const { pool } = require('./db');
const { exec } = require('child_process');
const crypto = require('crypto');

const TOKEN = '8476571092:AAEXr5-AW204xEkxcWl2o7hIVGKrCTUarfs';
const ADMIN_ID = 354147610;
let offset = 0;

function tg(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.telegram.org', path: '/bot' + TOKEN + '/' + method,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject); req.write(data); req.end();
  });
}

function send(text) { return tg('sendMessage', { chat_id: ADMIN_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }); }

async function handleCmd(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');
  try {

if (cmd === '/stats') {
  const users = await pool.query('SELECT COUNT(*) as c FROM users');
  const wallets = await pool.query('SELECT COUNT(*) as c FROM users WHERE wallet_address IS NOT NULL');
  const today = await pool.query("SELECT COUNT(*) as c FROM scores WHERE created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')");
  const total = await pool.query('SELECT COUNT(*) as c FROM scores');
  const best = await pool.query('SELECT MAX(best_score) as m FROM users');
  return send('📊 <b>Blobi Leap Stats</b>\n\n👥 Players: <b>' + users.rows[0].c + '</b>\n💎 Wallets: <b>' + wallets.rows[0].c + '</b>\n🎮 Games today: <b>' + today.rows[0].c + '</b>\n🎮 Games total: <b>' + total.rows[0].c + '</b>\n🏆 Highest score: <b>' + (best.rows[0].m || 0) + '</b>');
}

if (cmd === '/top') {
  const r = await pool.query('SELECT nickname, best_score, wallet_address IS NOT NULL as hw FROM users ORDER BY best_score DESC LIMIT 10');
  if (!r.rows.length) return send('No players yet.');
  let msg = '🏆 <b>Top 10 All Time</b>\n\n';
  r.rows.forEach((row, i) => { msg += (i < 3 ? ['🥇','🥈','🥉'][i] : (i+1)+'.') + ' ' + row.nickname + ': <b>' + row.best_score + '</b>' + (row.hw ? ' 💎' : '') + '\n'; });
  return send(msg);
}

if (cmd === '/today') {
  const cnt = await pool.query("SELECT COUNT(*) as c FROM scores WHERE created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')");
  const r = await pool.query("SELECT u.nickname, MAX(s.score) as best, u.wallet_address IS NOT NULL as hw FROM scores s JOIN users u ON s.user_id = u.id WHERE s.created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') GROUP BY u.id, u.nickname, u.wallet_address ORDER BY best DESC LIMIT 10");
  let msg = '📅 <b>Today</b> (' + cnt.rows[0].c + ' games)\n\n';
  if (!r.rows.length) msg += 'No scores yet today.';
  else r.rows.forEach((row, i) => { msg += (i < 3 ? ['🥇','🥈','🥉'][i] : (i+1)+'.') + ' ' + row.nickname + ': <b>' + row.best + '</b>' + (row.hw ? ' 💎' : '') + '\n'; });
  return send(msg);
}

if (cmd === '/user') {
  if (!arg) return send('Usage: /user [nickname]');
  const r = await pool.query('SELECT u.*, COUNT(s.id) as game_count FROM users u LEFT JOIN scores s ON s.user_id = u.id WHERE LOWER(u.nickname) = LOWER($1) GROUP BY u.id', [arg]);
  if (!r.rows.length) return send('User not found: ' + arg);
  const u = r.rows[0];
  const tier = u.best_score >= 150 ? 'MYTHIC' : u.best_score >= 100 ? 'LEGEND' : u.best_score >= 75 ? 'MASTER' : u.best_score >= 50 ? 'PRO' : u.best_score >= 25 ? 'RUNNER' : u.best_score >= 10 ? 'ROOKIE' : 'NEWBIE';
  const ago = Math.round((Date.now() - new Date(u.created_at).getTime()) / 3600000);
  let msg = '👤 <b>' + u.nickname + '</b> (' + tier + ')\n\n🏆 Best: <b>' + u.best_score + '</b>\n🎮 Games: <b>' + u.total_games + '</b>\n📊 Scores: <b>' + u.game_count + '</b>\n🕐 Joined: <b>' + (ago < 1 ? 'just now' : ago + 'h ago') + '</b>\n';
  if (u.wallet_address) { const short = u.wallet_address.substring(0,4) + '...' + u.wallet_address.substring(u.wallet_address.length-4); msg += '💎 Wallet: <b>' + short + '</b>\n🔗 <a href="https://stellar.expert/explorer/public/account/' + u.wallet_address + '">View on Explorer</a>'; }
  else msg += '💎 Wallet: not connected';
  return send(msg);
}

if (cmd === '/recent') {
  const r = await pool.query('SELECT u.nickname, s.score, s.speed, s.created_at FROM scores s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 10');
  if (!r.rows.length) return send('No scores yet.');
  let msg = '🕐 <b>Recent Scores</b>\n\n';
  r.rows.forEach(row => { const ago = Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000); msg += row.nickname + ': <b>' + row.score + '</b> (' + row.speed.toFixed(1) + 'x) — ' + (ago < 1 ? 'just now' : ago + 'm ago') + '\n'; });
  return send(msg);
}

if (cmd === '/health') {
  try { await pool.query('SELECT 1'); const mem = process.memoryUsage(); return send('🔧 <b>Health</b>\n\n✅ Server OK\n✅ DB OK\n⏱ Uptime: ' + Math.round(process.uptime()/3600) + 'h\n💾 Mem: ' + Math.round(mem.rss/1024/1024) + 'MB'); }
  catch (e) { return send('❌ DB: ' + e.message); }
}

if (cmd === '/errors') {
  return new Promise(resolve => { exec('tail -20 /var/log/blobi-leap/error.log 2>/dev/null || echo "No errors"', (err, stdout) => { resolve(send('🚨 <b>Errors</b>\n\n<pre>' + stdout.trim().split('\n').slice(-5).join('\n').substring(0,3000) + '</pre>')); }); });
}

if (cmd === '/ban') {
  if (!arg) return send('Usage: /ban [nickname]');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false").catch(()=>{});
  const r = await pool.query('UPDATE users SET banned = true WHERE LOWER(nickname) = LOWER($1) RETURNING nickname', [arg]);
  return send(r.rows.length ? '🔨 Banned: <b>' + r.rows[0].nickname + '</b>' : 'User not found');
}

if (cmd === '/unban') {
  if (!arg) return send('Usage: /unban [nickname]');
  const r = await pool.query('UPDATE users SET banned = false WHERE LOWER(nickname) = LOWER($1) RETURNING nickname', [arg]);
  return send(r.rows.length ? '✅ Unbanned: <b>' + r.rows[0].nickname + '</b>' : 'User not found');
}

if (cmd === '/rename') {
  const p = arg.split(/\s+/); if (p.length < 2) return send('Usage: /rename [old] [new]');
  const exists = await pool.query('SELECT id FROM users WHERE LOWER(nickname)=LOWER($1)', [p[1]]);
  if (exists.rows.length) return send('Name taken: ' + p[1]);
  const r = await pool.query('UPDATE users SET nickname=$1 WHERE LOWER(nickname)=LOWER($2) RETURNING nickname', [p[1], p[0]]);
  return send(r.rows.length ? '✏️ Renamed: ' + p[0] + ' → <b>' + r.rows[0].nickname + '</b>' : 'User not found');
}

if (cmd === '/delscore') {
  if (!arg) return send('Usage: /delscore [id]');
  const r = await pool.query('DELETE FROM scores WHERE id=$1 RETURNING id,score,user_id', [parseInt(arg)]);
  if (!r.rows.length) return send('Score not found');
  const u = await pool.query('SELECT nickname FROM users WHERE id=$1', [r.rows[0].user_id]);
  const nb = await pool.query('SELECT COALESCE(MAX(score),0) as m FROM scores WHERE user_id=$1', [r.rows[0].user_id]);
  await pool.query('UPDATE users SET best_score=$1 WHERE id=$2', [nb.rows[0].m, r.rows[0].user_id]);
  return send('🗑 Deleted #' + r.rows[0].id + ' (' + r.rows[0].score + ') from ' + (u.rows[0]?.nickname||'?') + '\nNew best: ' + nb.rows[0].m);
}

if (cmd === '/announce') {
  if (!arg) return send('Usage: /announce [msg]');
  return send('📢 <b>Announcement</b>\n\n' + arg);
}

if (cmd === '/mint') {
  const p = arg.split(/\s+/); const effect = (p[0]||'').toLowerCase(); const count = parseInt(p[1]) || 1;
  if (!['star','bolt','ship','void','aura'].includes(effect)) return send('Usage: /mint [star|bolt|ship|void|aura] [count]');
  if (count < 1 || count > 50) return send('Count: 1-50');
  const supply = await pool.query('SELECT * FROM card_supply WHERE effect=$1 AND season=1', [effect]);
  if (!supply.rows.length) return send('No supply for ' + effect);
  let created = [];
  for (let i = 0; i < count; i++) {
    const next = await pool.query('SELECT COALESCE(MAX(number),0)+1 as n FROM cosmic_cards WHERE effect=$1 AND season=1', [effect]);
    const num = next.rows[0].n; if (num > supply.rows[0].total) break;
    const seed = crypto.randomBytes(4).toString('hex');
    const id = effect.toUpperCase() + '-S1-' + String(num).padStart(4, '0');
    await pool.query("INSERT INTO cosmic_cards (id,effect,season,number,seed,rarity,mint_type) VALUES ($1,$2,1,$3,$4,$5,'admin')", [id, effect, num, seed, supply.rows[0].rarity]);
    created.push(id + ' seed:' + seed);
  }
  return send('🃏 <b>Minted ' + created.length + ' ' + effect.toUpperCase() + '</b>\n\n' + created.join('\n'));
}

if (cmd === '/cards') {
  const effect = (arg||'').toLowerCase();
  if (effect && ['star','bolt','ship','void','aura'].includes(effect)) {
    const r = await pool.query("SELECT c.id, c.seed, u.nickname FROM cosmic_cards c LEFT JOIN users u ON c.owner_id=u.id WHERE c.effect=$1 AND c.season=1 ORDER BY c.number LIMIT 20", [effect]);
    if (!r.rows.length) return send('No ' + effect + ' cards minted yet.');
    let msg = '🃏 <b>' + effect.toUpperCase() + ' cards</b>\n\n';
    r.rows.forEach(row => { msg += row.id + ' — ' + (row.nickname ? '@'+row.nickname : '<i>unclaimed</i>') + '\n'; });
    return send(msg);
  }
  const supply = await pool.query('SELECT * FROM card_supply WHERE season=1 ORDER BY effect');
  let msg = '🃏 <b>Season 1 Supply</b>\n\n';
  for (const s of supply.rows) {
    const m = await pool.query('SELECT COUNT(*) as c FROM cosmic_cards WHERE effect=$1 AND season=1', [s.effect]);
    msg += s.rarity + ' ' + s.effect.toUpperCase() + ': <b>' + m.rows[0].c + '/' + s.total + '</b> (' + s.mint_price + ' XLM)\n';
  }
  return send(msg);
}

if (cmd === '/give') {
  const p = arg.split(/\s+/); if (p.length < 2) return send('Usage: /give [card_id] [nickname]');
  const user = await pool.query('SELECT id FROM users WHERE LOWER(nickname)=LOWER($1)', [p[1]]);
  if (!user.rows.length) return send('User not found: ' + p[1]);
  const card = await pool.query('SELECT id FROM cosmic_cards WHERE id=$1', [p[0].toUpperCase()]);
  if (!card.rows.length) return send('Card not found: ' + p[0]);
  await pool.query('UPDATE cosmic_cards SET owner_id=$1, claimed_at=NOW() WHERE id=$2', [user.rows[0].id, p[0].toUpperCase()]);
  return send('🎁 Gave <b>' + p[0].toUpperCase() + '</b> to @' + p[1]);
}

if (cmd === '/rewards') return handleRewards();
if (cmd === '/send_rewards') return handleSendRewards();
if (cmd === '/hot_balance') return handleHotBalance();

if (cmd === '/help' || cmd === '/start') {
  return send('🟢 <b>Blobi Leap Admin</b>\n\n📊 /stats\n🏆 /top\n📅 /today\n👤 /user [name]\n🕐 /recent\n🔧 /health\n🚨 /errors\n🔨 /ban [name]\n✅ /unban [name]\n✏️ /rename [old] [new]\n🗑 /delscore [id]\n📢 /announce [msg]\n\n🃏 <b>Cards</b>\n/mint [effect] [count]\n/cards [effect]\n/give [card_id] [nickname]\n\n💰 <b>Rewards</b>\n/rewards — preview\n/send_rewards — distribute\n/hot_balance — check wallet');
}

  } catch (e) { console.error('Bot error:', e); return send('❌ ' + e.message); }
}

async function poll() {
  try {
    const res = await tg('getUpdates', { offset, timeout: 30 });
    if (res.ok && res.result.length) {
      for (const upd of res.result) {
        offset = upd.update_id + 1;
        if (upd.message && upd.message.chat.id === ADMIN_ID && upd.message.text) await handleCmd(upd.message.text);
      }
    }
  } catch (e) { console.warn('Poll:', e.message); }
  setTimeout(poll, 1000);
}

pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false").catch(()=>{});
console.log('Blobi bot started');
send('🟢 <b>Blobi Leap bot restarted</b>');
poll();

// ========== REWARD SYSTEM ==========
const distribute = require('./distribute');

// /rewards - preview
async function handleRewards(chatId) {
  try {
    const preview = await distribute.previewRewards();
    let msg = '📊 <b>Weekly Rewards Preview</b>\n\n';
    if (preview.eligible.length === 0) {
      msg += 'No eligible players this week.\n';
    } else {
      preview.eligible.forEach(function(p) {
        msg += '#' + p.rank + ' <b>' + p.nickname + '</b> — ' + p.score + 'pts — ' + p.amount + ' BLOBI ✓\n';
      });
    }
    if (preview.skipped.length > 0) {
      msg += '\n⏭ Skipped:\n';
      preview.skipped.slice(0, 5).forEach(function(p) {
        msg += p.nickname + ' — ' + p.score + 'pts (' + p.reason + ')\n';
      });
    }
    msg += '\n💰 Total: ' + preview.totalNeeded + ' BLOBI';
    msg += '\n🏦 Hot wallet: ' + Math.floor(preview.hotBalance).toLocaleString() + ' BLOBI';
    send(msg);
  } catch (e) { send('Error: ' + e.message); }
}

// /send_rewards - manual send
async function handleSendRewards(chatId) {
  try {
    send('⏳ Sending rewards...');
    const results = await distribute.sendRewards();
    let msg = '📤 <b>Rewards Sent</b>\n\n';
    let totalSent = 0;
    results.forEach(function(r) {
      if (r.status === 'sent') {
        msg += '✅ ' + r.nickname + ' #' + r.rank + ': ' + r.amount + ' BLOBI\n';
        totalSent += parseFloat(r.amount);
      } else {
        msg += '⏭ ' + r.nickname + ': ' + r.status + '\n';
      }
    });
    msg += '\n💰 Total sent: ' + totalSent + ' BLOBI';
    const bal = await distribute.getHotBalance();
    msg += '\n🏦 Hot wallet remaining: ' + Math.floor(bal).toLocaleString() + ' BLOBI';
    send(msg);
  } catch (e) { send('❌ Send failed: ' + e.message); }
}

// /hot_balance - check hot wallet
async function handleHotBalance(chatId) {
  try {
    const bal = await distribute.getHotBalance();
    send('🏦 Hot wallet: <b>' + Math.floor(bal).toLocaleString() + ' BLOBI</b>');
  } catch (e) { send('Error: ' + e.message); }
}

// Auto weekly rewards - every Sunday 00:00 UTC
function scheduleWeeklyRewards() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + (7 - now.getUTCDay()) % 7);
  next.setUTCHours(0, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  const delay = next.getTime() - now.getTime();
  console.log('Next rewards: ' + next.toISOString() + ' (in ' + Math.round(delay / 3600000) + 'h)');
  setTimeout(async function() {
    try {
      send('⏰ <b>Auto weekly rewards starting...</b>');
      const results = await distribute.sendRewards();
      let msg = '🏆 <b>Weekly Rewards Auto-Distributed</b>\n\n';
      let totalSent = 0;
      results.forEach(function(r) {
        if (r.status === 'sent') {
          msg += '✅ ' + r.nickname + ' #' + r.rank + ': ' + r.amount + ' BLOBI\n';
          totalSent += parseFloat(r.amount);
        } else {
          msg += '⏭ ' + r.nickname + ': ' + r.status + '\n';
        }
      });
      msg += '\n💰 Total: ' + totalSent + ' BLOBI';
      const bal = await distribute.getHotBalance();
      msg += '\n🏦 Remaining: ' + Math.floor(bal).toLocaleString() + ' BLOBI';
      send(msg);
    } catch (e) { send('❌ Auto rewards failed: ' + e.message); }
    scheduleWeeklyRewards();
  }, delay);
}
scheduleWeeklyRewards();
