const router = require('express').Router();
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');
const notify = require('../notify');

router.post('/', authRequired, async (req, res) => {
  try {
    const { score, speed, nearMiss, bestCombo, survivalTime, totalLeaps,
            sawStar, sawLightning, sawRocket, sawBlackhole, sawAurora } = req.body;
    if (typeof score !== 'number' || score < 0) return res.status(400).json({ error: 'Invalid score' });
    if (totalLeaps < 2 && score > 5) return res.status(400).json({ error: 'Suspicious' });
    if (survivalTime > 0 && score > survivalTime * 3) return res.status(400).json({ error: 'Suspicious' });
    const prev = await pool.query('SELECT best_score, nickname FROM users WHERE id = $1', [req.user.id]);
    const prevBest = prev.rows[0]?.best_score || 0;
    const nick = prev.rows[0]?.nickname || 'unknown';
    await pool.query(
      `INSERT INTO scores (user_id, score, speed, near_miss, best_combo, survival_time, total_leaps,
       saw_star, saw_lightning, saw_rocket, saw_blackhole, saw_aurora)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [req.user.id, score, speed||1, nearMiss||0, bestCombo||0, survivalTime||0, totalLeaps||0,
       sawStar||false, sawLightning||false, sawRocket||false, sawBlackhole||false, sawAurora||false]
    );
    await pool.query(
      'UPDATE users SET best_score = GREATEST(best_score, $1), total_games = total_games + 1 WHERE id = $2',
      [score, req.user.id]
    );
    if (score > prevBest && score >= 10) notify.newHighScore(nick, score, prevBest);
    if (sawBlackhole) notify.rareEvent(nick, 'blackhole', score);
    if (sawAurora) notify.rareEvent(nick, 'aurora', score);
    const rankQ = await pool.query(
      'SELECT COUNT(*)+1 as rank FROM users WHERE best_score > (SELECT best_score FROM users WHERE id=$1)', [req.user.id]
    );
    const weeklyQ = await pool.query(
      'SELECT rank FROM (SELECT u.id, RANK() OVER (ORDER BY MAX(s.score) DESC) as rank FROM scores s JOIN users u ON s.user_id = u.id WHERE s.created_at > NOW() - INTERVAL \'7 days\' GROUP BY u.id) t WHERE id = $1',
      [req.user.id]
    );
    const weeklyRank = weeklyQ.rows.length ? parseInt(weeklyQ.rows[0].rank) : null;
    const rewardTable = [300, 200, 150, 100, 100, 50, 50, 50, 50, 50];
    const rewardAmount = weeklyRank && weeklyRank <= 10 ? rewardTable[weeklyRank - 1] : 0;
    res.json({ success: true, rank: rankQ.rows[0].rank, weeklyRank, rewardAmount });
  } catch (e) {
    console.error('Score error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
