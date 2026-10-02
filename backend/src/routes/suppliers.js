const router = require('express').Router();
const { db } = require('../db');
const { HttpError, validate, wrap } = require('../utils');
const { requireRole } = require('../middleware/auth');
const { log } = require('../services/stock');

const rules = {
  name: { type: 'string', required: true, maxLen: 120, label: 'Name' },
  email: { type: 'string', email: true, maxLen: 120, label: 'Email' },
  phone: { type: 'string', maxLen: 30, label: 'Phone' },
  address: { type: 'string', maxLen: 250, label: 'Address' },
};

router.get('/', wrap((req, res) => {
  res.json(db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.active = 1) AS product_count
    FROM suppliers s ORDER BY s.name`).all());
}));

router.post('/', requireRole('admin', 'manager'), wrap((req, res) => {
  const d = validate(req.body, rules);
  const info = db.prepare('INSERT INTO suppliers (name,email,phone,address) VALUES (?,?,?,?)').run(d.name, d.email, d.phone, d.address);
  log('supplier', info.lastInsertRowid, 'CREATE', d, req.user.id);
  res.status(201).json({ id: info.lastInsertRowid, ...d });
}));

router.put('/:id', requireRole('admin', 'manager'), wrap((req, res) => {
  const d = validate(req.body, rules);
  const r = db.prepare('UPDATE suppliers SET name=?,email=?,phone=?,address=? WHERE id=?').run(d.name, d.email, d.phone, d.address, req.params.id);
  if (!r.changes) throw new HttpError(404, 'Supplier not found');
  log('supplier', Number(req.params.id), 'UPDATE', d, req.user.id);
  res.json({ id: Number(req.params.id), ...d });
}));

router.delete('/:id', requireRole('admin', 'manager'), wrap((req, res) => {
  const id = Number(req.params.id);
  if (db.prepare('SELECT 1 FROM purchase_orders WHERE supplier_id = ?').get(id)) throw new HttpError(409, 'Supplier has purchase orders and cannot be deleted');
  const r = db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  if (!r.changes) throw new HttpError(404, 'Supplier not found');
  log('supplier', id, 'DELETE', null, req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
