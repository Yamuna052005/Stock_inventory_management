const { db } = require('../db');
const { HttpError } = require('../utils');

function log(entity, entityId, action, details, userId) {
  db.prepare('INSERT INTO inventory_logs (entity, entity_id, action, details, user_id) VALUES (?,?,?,?,?)')
    .run(entity, entityId, action, details ? JSON.stringify(details) : null, userId || null);
}

/**
 * Atomically apply a stock movement. Never lets a balance go below zero.
 */
const applyMovement = db.transaction(({ productId, warehouseId, type, quantity, reference, note, userId }) => {
  const product = db.prepare('SELECT id, name, active FROM products WHERE id = ?').get(productId);
  if (!product) throw new HttpError(404, 'Product not found');
  if (!product.active) throw new HttpError(400, 'Product is archived');
  const wh = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(warehouseId);
  if (!wh) throw new HttpError(404, 'Warehouse not found');

  const row = db.prepare('SELECT quantity FROM stock_levels WHERE product_id = ? AND warehouse_id = ?').get(productId, warehouseId);
  const current = row ? row.quantity : 0;
  const next = type === 'IN' ? current + quantity : current - quantity;
  if (next < 0) {
    throw new HttpError(409, `Insufficient stock: only ${current} unit(s) of "${product.name}" available in this warehouse`);
  }
  db.prepare(`INSERT INTO stock_levels (product_id, warehouse_id, quantity) VALUES (?,?,?)
              ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = excluded.quantity`)
    .run(productId, warehouseId, next);
  const info = db.prepare(`INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, balance_after, reference, note, user_id)
              VALUES (?,?,?,?,?,?,?,?)`).run(productId, warehouseId, type, quantity, next, reference || null, note || null, userId || null);
  log('stock', info.lastInsertRowid, `STOCK_${type}`, { productId, warehouseId, quantity, balance: next, reference }, userId);
  return { id: info.lastInsertRowid, productId, warehouseId, type, quantity, balance_after: next };
});

module.exports = { applyMovement, log };
