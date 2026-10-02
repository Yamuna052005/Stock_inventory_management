const router = require('express').Router();
const { db } = require('../db');
const { wrap, toCsv } = require('../utils');
const { requireRole } = require('../middleware/auth');

router.use(requireRole('admin', 'manager'));

function send(req, res, rows, name) {
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
    return res.send(toCsv(rows));
  }
  res.json(rows);
}

router.get('/inventory', wrap((req, res) => {
  const rows = db.prepare(`SELECT p.sku, p.name, p.category, w.name AS warehouse, sl.quantity, p.unit_price,
      ROUND(sl.quantity * p.unit_price, 2) AS stock_value
    FROM stock_levels sl JOIN products p ON p.id = sl.product_id JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE p.active = 1 ORDER BY p.name, w.name`).all();
  send(req, res, rows, 'inventory-report');
}));

router.get('/movements', wrap((req, res) => {
  const { from, to } = req.query;
  const where = [];
  const params = [];
  if (from) { where.push('date(m.created_at) >= date(?)'); params.push(from); }
  if (to) { where.push('date(m.created_at) <= date(?)'); params.push(to); }
  const rows = db.prepare(`SELECT m.created_at AS date, p.sku, p.name AS product, w.name AS warehouse, m.type, m.quantity,
      m.balance_after, m.reference, u.name AS user
    FROM stock_movements m JOIN products p ON p.id = m.product_id JOIN warehouses w ON w.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC`).all(...params);
  send(req, res, rows, 'movements-report');
}));

// Predictive restocking: average daily OUT over last 30 days -> days of cover and a suggested order quantity
router.get('/restock', wrap((req, res) => {
  const rows = db.prepare(`SELECT p.id, p.sku, p.name, p.category, p.reorder_level,
      COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.product_id = p.id),0) AS total_stock,
      COALESCE((SELECT SUM(quantity) FROM stock_movements m WHERE m.product_id = p.id AND m.type='OUT' AND date(m.created_at) >= date('now','-30 days')),0) AS out_30d
    FROM products p WHERE p.active = 1`).all().map((r) => {
    const daily = r.out_30d / 30;
    const daysOfCover = daily > 0 ? Math.round((r.total_stock / daily) * 10) / 10 : null;
    const target = Math.ceil(daily * 14 + r.reorder_level);
    const suggested = Math.max(0, target - r.total_stock);
    return { sku: r.sku, name: r.name, category: r.category, current_stock: r.total_stock, reorder_level: r.reorder_level,
      avg_daily_out: Math.round(daily * 100) / 100, days_of_cover: daysOfCover, suggested_order_qty: suggested };
  }).filter((r) => r.suggested_order_qty > 0)
    .sort((a, b) => (a.days_of_cover ?? 1e9) - (b.days_of_cover ?? 1e9));
  send(req, res, rows, 'restock-suggestions');
}));

module.exports = router;
