const router = require('express').Router();
const { pool } = require('../db');
const { authOptional } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

router.get('/:period', apiLimiter, authOptional, async (req, res) => {
  try {
    const { period } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    let tf = '';
    if (period === 'daily') tf = "AND s.created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')";
    else if (period === 'weekly') tf = "AND s.created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '1 day'";
    else if (period !== 'all') return res.status(400).json({ error: 'Invalid period' });

    const result = await pool.query(`
      SELECT u.nickname, MAX(s.score) as best_score, COUNT(s.id) as games,
             MAX(s.speed) as top_speed, u.wallet_address IS NOT NULL as has_wallet
      FROM scores s JOIN users u ON s.user_id = u.id
      WHERE 1=1 ${tf}
      GROUP BY u.id, u.nickname, u.wallet_address
      ORDER BY best_score DESC LIMIT $1
    `, [limit]);

    const leaderboard = result.rows.map((row, i) => ({
      rank: i + 1,
      nickname: row.nickname,
      score: parseInt(row.best_score),
      games: parseInt(row.games),
      topSpeed: parseFloat(row.top_speed),
      hasWallet: row.has_wallet
    }));

    let myRank = null;
    if (req.user) {
      let tf2 = '';
      if (period === 'daily') tf2 = "AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')";
      else if (period === 'weekly') tf2 = "AND created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC' + INTERVAL '1 day') - INTERVAL '1 day'";
      const myBest = await pool.query(
        `SELECT MAX(score) as best FROM scores WHERE user_id = $1 ${tf2}`, [req.user.id]
      );
      const myScore = myBest.rows[0]?.best || 0;
      const rankRes = await pool.query(
        `SELECT COUNT(DISTINCT user_id) + 1 as rank FROM scores WHERE score > $1 ${tf2}`, [myScore]
      );
      myRank = parseInt(rankRes.rows[0].rank);
    }

    res.json({ period, leaderboard, myRank, total: leaderboard.length });
  } catch (e) {
    console.error('Leaderboard error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
