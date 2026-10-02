const router = require('express').Router();
const { db } = require('../db');
const { validate, wrap } = require('../utils');
const { applyMovement } = require('../services/stock');

const rules = {
  product_id: { type: 'int', required: true, min: 1, label: 'Product' },
  warehouse_id: { type: 'int', required: true, min: 1, label: 'Warehouse' },
  quantity: { type: 'int', required: true, min: 1, max: 1000000, label: 'Quantity' },
  reference: { type: 'string', maxLen: 80, label: 'Reference' },
  note: { type: 'string', maxLen: 300, label: 'Note' },
};

const handler = (type) => wrap((req, res) => {
  const d = validate(req.body, rules);
  const result = applyMovement({ productId: d.product_id, warehouseId: d.warehouse_id, type, quantity: d.quantity, reference: d.reference, note: d.note, userId: req.user.id });
  res.status(201).json(result);
});

router.post('/in', handler('IN'));
router.post('/out', handler('OUT'));

router.get('/movements', wrap((req, res) => {
  const { product_id, warehouse_id, type, from, to } = req.query;
  const where = [];
  const params = [];
  if (product_id) { where.push('m.product_id = ?'); params.push(Number(product_id)); }
  if (warehouse_id) { where.push('m.warehouse_id = ?'); params.push(Number(warehouse_id)); }
  if (type === 'IN' || type === 'OUT') { where.push('m.type = ?'); params.push(type); }
  if (from) { where.push('date(m.created_at) >= date(?)'); params.push(from); }
  if (to) { where.push('date(m.created_at) <= date(?)'); params.push(to); }
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db.prepare(`SELECT m.*, p.name AS product_name, p.sku, w.name AS warehouse_name, u.name AS user_name
    FROM stock_movements m JOIN products p ON p.id = m.product_id JOIN warehouses w ON w.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY m.id DESC LIMIT ${limit}`).all(...params);
  res.json(rows);
}));

router.get('/logs', wrap((req, res) => {
  res.json(db.prepare(`SELECT l.*, u.name AS user_name FROM inventory_logs l LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.id DESC LIMIT 200`).all());
}));

module.exports = router;
