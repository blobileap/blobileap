const https = require('https');

const BOT_TOKEN = '8476571092:AAEXr5-AW204xEkxcWl2o7hIVGKrCTUarfs';
const CHAT_ID = '354147610';

function send(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: '/bot' + BOT_TOKEN + '/sendMessage',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  });
  req.on('error', e => console.warn('TG notify error:', e.message));
  req.write(data);
  req.end();
}

function newPlayer(nickname, ua) {
  const device = /Mobile|Android|iPhone/i.test(ua || '') ? '📱' : '💻';
  send(`🆕 <b>New player</b>\n${device} @${nickname}`);
}

function newHighScore(nickname, score, prev) {
  const tier = score >= 150 ? 'MYTHIC ✦' : score >= 100 ? 'LEGEND ★★★★★' :
    score >= 75 ? 'MASTER ★★★★' : score >= 50 ? 'PRO ★★★' :
    score >= 25 ? 'RUNNER ★★' : score >= 10 ? 'ROOKIE ★' : 'NEWBIE';
  send(`🏆 <b>New high score</b>\n@${nickname}: <b>${score}</b> (${tier})\nPrevious: ${prev || 0}`);
}

function walletConnected(nickname, wallet) {
  const short = wallet.substring(0, 4) + '...' + wallet.substring(wallet.length - 4);
  send(`💎 <b>Wallet connected</b>\n@${nickname} → ${short}`);
}

function rareEvent(nickname, event, score) {
  const icons = { blackhole: '🕳', aurora: '🌌', allCosmic: '✨' };
  send(`${icons[event] || '⭐'} <b>Rare event</b>\n@${nickname} saw ${event}! (score: ${score})`);
}

function milestone(type, count) {
  send(`🎮 <b>Milestone</b>\n${type}: <b>${count}</b>`);
}

module.exports = { send, newPlayer, newHighScore, walletConnected, rareEvent, milestone };
