const router = require('express').Router();
const { db } = require('../db');
const { HttpError, validate, wrap } = require('../utils');
const { requireRole } = require('../middleware/auth');
const { log } = require('../services/stock');

const rules = {
  sku: { type: 'string', required: true, maxLen: 40, label: 'SKU' },
  barcode: { type: 'string', maxLen: 40, label: 'Barcode' },
  name: { type: 'string', required: true, maxLen: 120, label: 'Name' },
  category: { type: 'string', required: true, maxLen: 60, label: 'Category' },
  description: { type: 'string', maxLen: 500, label: 'Description' },
  unit_price: { type: 'number', required: true, min: 0, label: 'Unit price' },
  reorder_level: { type: 'int', required: true, min: 0, label: 'Reorder level' },
  supplier_id: { type: 'int', min: 1, label: 'Supplier' },
};

const BASE = `
  SELECT p.*, s.name AS supplier_name,
         COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.product_id = p.id), 0) AS total_stock
  FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id`;

function status(p) {
  if (p.total_stock === 0) return 'out';
  if (p.total_stock <= p.reorder_level) return 'low';
  return 'ok';
}

router.get('/', wrap((req, res) => {
  const { category, stock, search, warehouse_id, includeArchived } = req.query;
  const where = [];
  const params = [];
  if (!includeArchived) where.push('p.active = 1');
  if (category) { where.push('p.category = ?'); params.push(category); }
  if (search) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (warehouse_id) { where.push('EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.product_id = p.id AND sl.warehouse_id = ? AND sl.quantity > 0)'); params.push(Number(warehouse_id)); }
  let sql = `${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  const having = { out: 'total_stock = 0', low: 'total_stock > 0 AND total_stock <= reorder_level', ok: 'total_stock > reorder_level' }[stock];
  if (having) sql = `SELECT * FROM (${sql}) WHERE ${having}`;
  const rows = db.prepare(sql + ' ORDER BY ' + (having ? '' : 'p.') + 'name').all(...params).map((p) => ({ ...p, status: status(p) }));
  res.json(rows);
}));

router.get('/categories', wrap((req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all().map((r) => r.category));
}));

// Barcode scan simulation: look up a product by barcode or SKU
router.get('/barcode/:code', wrap((req, res) => {
  const p = db.prepare(`${BASE} WHERE (p.barcode = ? OR p.sku = ?) AND p.active = 1`).get(req.params.code, req.params.code);
  if (!p) throw new HttpError(404, 'No product matches that barcode');
  res.json({ ...p, status: status(p) });
}));

router.get('/:id', wrap((req, res) => {
  const p = db.prepare(`${BASE} WHERE p.id = ?`).get(req.params.id);
  if (!p) throw new HttpError(404, 'Product not found');
  const levels = db.prepare(`SELECT sl.warehouse_id, w.name AS warehouse_name, w.location, sl.quantity
    FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id WHERE sl.product_id = ? ORDER BY w.name`).all(p.id);
  res.json({ ...p, status: status(p), levels });
}));

function checkUnique(d, id) {
  const errs = {};
  if (db.prepare('SELECT 1 FROM products WHERE sku = ? AND id != ?').get(d.sku, id || 0)) errs.sku = 'SKU already exists';
  if (d.barcode && db.prepare('SELECT 1 FROM products WHERE barcode = ? AND id != ?').get(d.barcode, id || 0)) errs.barcode = 'Barcode already exists';
  if (d.supplier_id && !db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(d.supplier_id)) errs.supplier_id = 'Supplier does not exist';
  if (Object.keys(errs).length) throw new HttpError(409, 'Validation failed', errs);
}

router.post('/', requireRole('admin', 'manager'), wrap((req, res) => {
  const d = validate(req.body, rules);
  checkUnique(d);
  const info = db.prepare(`INSERT INTO products (sku,barcode,name,category,description,unit_price,reorder_level,supplier_id)
    VALUES (?,?,?,?,?,?,?,?)`).run(d.sku, d.barcode, d.name, d.category, d.description, d.unit_price, d.reorder_level, d.supplier_id);
  log('product', info.lastInsertRowid, 'CREATE', d, req.user.id);
  res.status(201).json({ id: info.lastInsertRowid, ...d });
}));

router.put('/:id', requireRole('admin', 'manager'), wrap((req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw new HttpError(404, 'Product not found');
  const d = validate(req.body, rules);
  checkUnique(d, id);
  db.prepare(`UPDATE products SET sku=?,barcode=?,name=?,category=?,description=?,unit_price=?,reorder_level=?,supplier_id=? WHERE id=?`)
    .run(d.sku, d.barcode, d.name, d.category, d.description, d.unit_price, d.reorder_level, d.supplier_id, id);
  log('product', id, 'UPDATE', d, req.user.id);
  res.json({ id, ...d });
}));

// Soft delete so stock history stays intact
router.delete('/:id', requireRole('admin', 'manager'), wrap((req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
  if (!r.changes) throw new HttpError(404, 'Product not found');
  log('product', id, 'ARCHIVE', null, req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
