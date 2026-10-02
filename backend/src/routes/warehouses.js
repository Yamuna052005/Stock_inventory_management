const router = require('express').Router();
const { db } = require('../db');
const { HttpError, validate, wrap } = require('../utils');
const { requireRole } = require('../middleware/auth');
const { log } = require('../services/stock');

const rules = {
  name: { type: 'string', required: true, maxLen: 80, label: 'Name' },
  location: { type: 'string', required: true, maxLen: 160, label: 'Location' },
  capacity: { type: 'int', required: true, min: 0, label: 'Capacity' },
};

router.get('/', wrap((req, res) => {
  res.json(db.prepare(`SELECT w.*,
      COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.warehouse_id = w.id),0) AS total_units,
      (SELECT COUNT(*) FROM stock_levels sl WHERE sl.warehouse_id = w.id AND sl.quantity > 0) AS product_count
    FROM warehouses w ORDER BY w.name`).all().map((w) => ({ ...w, utilization: w.capacity ? Math.round((w.total_units / w.capacity) * 100) : 0 })));
}));

router.get('/:id/stock', wrap((req, res) => {
  res.json(db.prepare(`SELECT p.id AS product_id, p.sku, p.name, p.category, sl.quantity
    FROM stock_levels sl JOIN products p ON p.id = sl.product_id
    WHERE sl.warehouse_id = ? AND sl.quantity > 0 ORDER BY p.name`).all(req.params.id));
}));

router.post('/', requireRole('admin'), wrap((req, res) => {
  const d = validate(req.body, rules);
  if (db.prepare('SELECT 1 FROM warehouses WHERE name = ?').get(d.name)) throw new HttpError(409, 'Validation failed', { name: 'Warehouse name already exists' });
  const info = db.prepare('INSERT INTO warehouses (name,location,capacity) VALUES (?,?,?)').run(d.name, d.location, d.capacity);
  log('warehouse', info.lastInsertRowid, 'CREATE', d, req.user.id);
  res.status(201).json({ id: info.lastInsertRowid, ...d });
}));

router.put('/:id', requireRole('admin'), wrap((req, res) => {
  const d = validate(req.body, rules);
  const r = db.prepare('UPDATE warehouses SET name=?,location=?,capacity=? WHERE id=?').run(d.name, d.location, d.capacity, req.params.id);
  if (!r.changes) throw new HttpError(404, 'Warehouse not found');
  log('warehouse', Number(req.params.id), 'UPDATE', d, req.user.id);
  res.json({ id: Number(req.params.id), ...d });
}));

module.exports = router;
