const jwt = require('jsonwebtoken');
const { HttpError } = require('../utils');

const secret = () => process.env.JWT_SECRET || 'dev-secret';

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, secret(), { expiresIn: '12h' });
}

function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = jwt.verify(token, secret());
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have permission to perform this action'));

module.exports = { sign, authenticate, requireRole };
