// Simple rate limiter without express-rate-limit
const limits = {};

function makeLimiter(windowMs, max) {
  return function(req, res, next) {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    if (!limits[key]) limits[key] = { count: 0, start: now };
    if (now - limits[key].start > windowMs) { limits[key] = { count: 0, start: now }; }
    limits[key].count++;
    if (limits[key].count > max) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}

const scoreLimiter = makeLimiter(60000, 30);
const authLimiter = makeLimiter(60000, 10);
const apiLimiter = makeLimiter(60000, 60);

module.exports = { scoreLimiter, authLimiter, apiLimiter };
