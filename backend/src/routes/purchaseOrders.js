const router = require('express').Router();
const { db } = require('../db');
const { HttpError, validate, wrap } = require('../utils');
const { requireRole } = require('../middleware/auth');
const { applyMovement, log } = require('../services/stock');

function withItems(po) {
  const items = db.prepare(`SELECT i.*, p.name AS product_name, p.sku FROM purchase_order_items i JOIN products p ON p.id = i.product_id WHERE i.po_id = ?`).all(po.id);
  return { ...po, items, total: items.reduce((s, i) => s + i.quantity * i.unit_cost, 0) };
}

router.get('/', wrap((req, res) => {
  const rows = db.prepare(`SELECT po.*, s.name AS supplier_name, w.name AS warehouse_name, u.name AS created_by_name
    FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id JOIN warehouses w ON w.id = po.warehouse_id
    LEFT JOIN users u ON u.id = po.created_by ORDER BY po.id DESC`).all();
  res.json(rows.map(withItems));
}));

router.post('/', requireRole('admin', 'manager'), wrap((req, res) => {
  const head = validate(req.body, {
    supplier_id: { type: 'int', required: true, min: 1, label: 'Supplier' },
    warehouse_id: { type: 'int', required: true, min: 1, label: 'Warehouse' },
  });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw new HttpError(400, 'Validation failed', { items: 'Add at least one item' });
  const clean = items.map((it, idx) => {
    try {
      return validate(it, {
        product_id: { type: 'int', required: true, min: 1, label: 'Product' },
        quantity: { type: 'int', required: true, min: 1, label: 'Quantity' },
        unit_cost: { type: 'number', required: true, min: 0, label: 'Unit cost' },
      });
    } catch (e) { throw new HttpError(400, 'Validation failed', { items: `Item ${idx + 1}: ${Object.values(e.details)[0]}` }); }
  });
  if (!db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(head.supplier_id)) throw new HttpError(404, 'Supplier not found');
  if (!db.prepare('SELECT 1 FROM warehouses WHERE id = ?').get(head.warehouse_id)) throw new HttpError(404, 'Warehouse not found');

  const create = db.transaction(() => {
    const info = db.prepare('INSERT INTO purchase_orders (po_number, supplier_id, warehouse_id, created_by) VALUES (?,?,?,?)')
      .run('TMP', head.supplier_id, head.warehouse_id, req.user.id);
    const id = info.lastInsertRowid;
    const poNumber = `PO-${String(id).padStart(5, '0')}`;
    db.prepare('UPDATE purchase_orders SET po_number = ? WHERE id = ?').run(poNumber, id);
    for (const it of clean) {
      if (!db.prepare('SELECT 1 FROM products WHERE id = ? AND active = 1').get(it.product_id)) throw new HttpError(404, `Product ${it.product_id} not found`);
      db.prepare('INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost) VALUES (?,?,?,?)').run(id, it.product_id, it.quantity, it.unit_cost);
    }
    log('purchase_order', id, 'CREATE', { poNumber, items: clean }, req.user.id);
    return id;
  });
  const id = create();
  res.status(201).json(withItems(db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id)));
}));

// Receiving a PO books every line as a stock IN movement, atomically.
router.post('/:id/receive', requireRole('admin', 'manager'), wrap((req, res) => {
  const id = Number(req.params.id);
  const run = db.transaction(() => {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!po) throw new HttpError(404, 'Purchase order not found');
    if (po.status !== 'PENDING') throw new HttpError(409, `Purchase order is already ${po.status.toLowerCase()}`);
    const items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(id);
    for (const it of items) {
      applyMovement({ productId: it.product_id, warehouseId: po.warehouse_id, type: 'IN', quantity: it.quantity, reference: po.po_number, note: 'Purchase order received', userId: req.user.id });
    }
    db.prepare("UPDATE purchase_orders SET status='RECEIVED', received_at=datetime('now') WHERE id = ?").run(id);
    log('purchase_order', id, 'RECEIVE', { poNumber: po.po_number }, req.user.id);
  });
  run();
  res.json(withItems(db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id)));
}));

router.post('/:id/cancel', requireRole('admin', 'manager'), wrap((req, res) => {
  const id = Number(req.params.id);
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  if (!po) throw new HttpError(404, 'Purchase order not found');
  if (po.status !== 'PENDING') throw new HttpError(409, `Purchase order is already ${po.status.toLowerCase()}`);
  db.prepare("UPDATE purchase_orders SET status='CANCELLED' WHERE id = ?").run(id);
  log('purchase_order', id, 'CANCEL', null, req.user.id);
  res.json(withItems(db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id)));
}));

module.exports = router;
