const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'blobi-dev-secret-change-me';

function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function authOptional(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch (e) {}
  }
  next();
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

module.exports = { authRequired, authOptional, signToken, SECRET };
