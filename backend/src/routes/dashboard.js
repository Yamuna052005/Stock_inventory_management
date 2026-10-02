const router = require('express').Router();
const { db } = require('../db');
const { wrap } = require('../utils');

router.get('/summary', wrap((req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const totals = one(`SELECT COUNT(*) AS products FROM products WHERE active = 1`);
  const units = one(`SELECT COALESCE(SUM(sl.quantity),0) AS units, COALESCE(SUM(sl.quantity * p.unit_price),0) AS value
    FROM stock_levels sl JOIN products p ON p.id = sl.product_id WHERE p.active = 1`);
  const stockCte = `SELECT p.id, p.sku, p.name, p.category, p.reorder_level,
      COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.product_id = p.id),0) AS total_stock
    FROM products p WHERE p.active = 1`;
  const lowStock = db.prepare(`SELECT * FROM (${stockCte}) WHERE total_stock <= reorder_level ORDER BY total_stock ASC, name LIMIT 10`).all();
  const counts = one(`SELECT SUM(total_stock = 0) AS out_of_stock, SUM(total_stock > 0 AND total_stock <= reorder_level) AS low FROM (${stockCte})`);
  const recent = db.prepare(`SELECT m.id, m.type, m.quantity, m.created_at, p.name AS product_name, w.name AS warehouse_name
    FROM stock_movements m JOIN products p ON p.id = m.product_id JOIN warehouses w ON w.id = m.warehouse_id ORDER BY m.id DESC LIMIT 8`).all();
  const byDay = db.prepare(`SELECT date(created_at) AS day,
      SUM(CASE WHEN type='IN' THEN quantity ELSE 0 END) AS stock_in,
      SUM(CASE WHEN type='OUT' THEN quantity ELSE 0 END) AS stock_out
    FROM stock_movements WHERE date(created_at) >= date('now','-6 days') GROUP BY date(created_at) ORDER BY day`).all();
  const byCategory = db.prepare(`SELECT p.category, COALESCE(SUM(sl.quantity),0) AS units
    FROM products p LEFT JOIN stock_levels sl ON sl.product_id = p.id WHERE p.active = 1 GROUP BY p.category ORDER BY units DESC`).all();
  const pendingPOs = one(`SELECT COUNT(*) AS n FROM purchase_orders WHERE status = 'PENDING'`).n;
  const warehouses = one('SELECT COUNT(*) AS n FROM warehouses').n;
  res.json({
    totalProducts: totals.products,
    totalUnits: units.units,
    totalValue: Math.round(units.value * 100) / 100,
    lowStockCount: counts.low || 0,
    outOfStockCount: counts.out_of_stock || 0,
    pendingPurchaseOrders: pendingPOs,
    warehouseCount: warehouses,
    lowStock,
    recentMovements: recent,
    movementsByDay: byDay,
    stockByCategory: byCategory,
    generatedAt: new Date().toISOString(),
  });
}));

module.exports = router;
