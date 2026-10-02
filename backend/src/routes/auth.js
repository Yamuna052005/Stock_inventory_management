const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { HttpError, validate, wrap } = require('../utils');
const { sign, authenticate, requireRole } = require('../middleware/auth');
const { log } = require('../services/stock');

router.post('/login', wrap((req, res) => {
  const { email, password } = validate(req.body, {
    email: { type: 'string', required: true, email: true, label: 'Email' },
    password: { type: 'string', required: true, label: 'Password' },
  });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) throw new HttpError(401, 'Invalid email or password');
  res.json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.get('/me', authenticate, wrap((req, res) => res.json({ user: req.user })));

// Admin-only user management
router.get('/users', authenticate, requireRole('admin'), wrap((req, res) => {
  res.json(db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all());
}));

router.post('/users', authenticate, requireRole('admin'), wrap((req, res) => {
  const d = validate(req.body, {
    name: { type: 'string', required: true, maxLen: 80, label: 'Name' },
    email: { type: 'string', required: true, email: true, label: 'Email' },
    password: { type: 'string', required: true, label: 'Password' },
    role: { type: 'string', required: true, enum: ['admin', 'manager', 'staff'], label: 'Role' },
  });
  if (d.password.length < 6) throw new HttpError(400, 'Validation failed', { password: 'Password must be at least 6 characters' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(d.email.toLowerCase())) throw new HttpError(409, 'Email already in use');
  const info = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run(d.name, d.email.toLowerCase(), bcrypt.hashSync(d.password, 10), d.role);
  log('user', info.lastInsertRowid, 'CREATE', { email: d.email, role: d.role }, req.user.id);
  res.status(201).json({ id: info.lastInsertRowid, name: d.name, email: d.email, role: d.role });
}));

module.exports = router;
