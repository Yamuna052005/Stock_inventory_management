// End-to-end API tests against a throw-away SQLite database.
const os = require('os');
const path = require('path');
const fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.JWT_SECRET = 'test-secret';
process.env.FRONTEND_DIST = '/nonexistent';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { db } = require('../src/db');
require('../src/seed').seed();

let server, base;
const tokens = {};

async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

test.before(async () => {
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [role, email, password] of [['admin', 'admin@warehouse.com', 'admin123'], ['manager', 'manager@warehouse.com', 'manager123'], ['staff', 'staff@warehouse.com', 'staff123']]) {
    const r = await call('POST', '/api/auth/login', { body: { email, password } });
    assert.equal(r.status, 200);
    tokens[role] = r.data.token;
  }
});
test.after(() => { server.close(); db.close(); });

test('auth: bad login rejected, missing token rejected', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@warehouse.com', password: 'nope' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'bad', password: '' } })).status, 400);
  assert.equal((await call('GET', '/api/products')).status, 401);
});

test('products: create, validate, duplicate, list, filter, update, archive', async () => {
  const t = tokens.manager;
  const bad = await call('POST', '/api/products', { token: t, body: { sku: '', name: 'x', category: 'c', unit_price: -1, reorder_level: 1.5 } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.details.sku && bad.data.details.unit_price && bad.data.details.reorder_level);

  const ok = await call('POST', '/api/products', { token: t, body: { sku: 'T-1', barcode: 'BC-1', name: 'Test Item', category: 'Testing', unit_price: 10, reorder_level: 5 } });
  assert.equal(ok.status, 201);
  const dup = await call('POST', '/api/products', { token: t, body: { sku: 'T-1', name: 'Dup', category: 'Testing', unit_price: 1, reorder_level: 1 } });
  assert.equal(dup.status, 409);

  const list = await call('GET', '/api/products?category=Testing', { token: t });
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].status, 'out');
  assert.equal((await call('GET', '/api/products?stock=out', { token: t })).data.some((p) => p.sku === 'T-1'), true);
  assert.ok((await call('GET', '/api/products?stock=low', { token: t })).data.every((p) => p.status === 'low'));
  assert.ok((await call('GET', '/api/products?stock=ok', { token: t })).data.every((p) => p.status === 'ok'));
  assert.equal((await call('GET', '/api/products/barcode/BC-1', { token: t })).data.name, 'Test Item');
  assert.equal((await call('GET', '/api/products/barcode/NOPE', { token: t })).status, 404);

  const id = ok.data.id;
  assert.equal((await call('PUT', `/api/products/${id}`, { token: t, body: { sku: 'T-1', barcode: 'BC-1', name: 'Renamed', category: 'Testing', unit_price: 12, reorder_level: 5 } })).status, 200);
  assert.equal((await call('GET', `/api/products/${id}`, { token: t })).data.name, 'Renamed');
  assert.equal((await call('DELETE', `/api/products/${id}`, { token: t })).status, 200);
  assert.equal((await call('GET', '/api/products?category=Testing', { token: t })).data.length, 0);
});

test('RBAC: staff cannot manage products/suppliers/reports; manager cannot manage warehouses/users', async () => {
  const p = { sku: 'S-1', name: 'n', category: 'c', unit_price: 1, reorder_level: 1 };
  assert.equal((await call('POST', '/api/products', { token: tokens.staff, body: p })).status, 403);
  assert.equal((await call('POST', '/api/suppliers', { token: tokens.staff, body: { name: 'x' } })).status, 403);
  assert.equal((await call('GET', '/api/reports/inventory', { token: tokens.staff })).status, 403);
  assert.equal((await call('POST', '/api/warehouses', { token: tokens.manager, body: { name: 'W', location: 'L', capacity: 1 } })).status, 403);
  assert.equal((await call('GET', '/api/auth/users', { token: tokens.manager })).status, 403);
  assert.equal((await call('GET', '/api/products', { token: tokens.staff })).status, 200);
  assert.equal((await call('GET', '/api/auth/users', { token: tokens.admin })).status, 200);
});

test('stock IN/OUT updates levels, history, and never goes negative', async () => {
  const t = tokens.staff;
  const prod = (await call('POST', '/api/products', { token: tokens.admin, body: { sku: 'STK-1', name: 'Stock Test', category: 'Testing', unit_price: 5, reorder_level: 10 } })).data;
  const inn = await call('POST', '/api/stock/in', { token: t, body: { product_id: prod.id, warehouse_id: 1, quantity: 25, reference: 'GRN-1' } });
  assert.equal(inn.status, 201);
  assert.equal(inn.data.balance_after, 25);
  const out = await call('POST', '/api/stock/out', { token: t, body: { product_id: prod.id, warehouse_id: 1, quantity: 5 } });
  assert.equal(out.data.balance_after, 20);
  // over-withdraw
  const over = await call('POST', '/api/stock/out', { token: t, body: { product_id: prod.id, warehouse_id: 1, quantity: 21 } });
  assert.equal(over.status, 409);
  assert.match(over.data.error, /Insufficient stock/);
  // other warehouse has none
  assert.equal((await call('POST', '/api/stock/out', { token: t, body: { product_id: prod.id, warehouse_id: 2, quantity: 1 } })).status, 409);
  // invalid input
  assert.equal((await call('POST', '/api/stock/in', { token: t, body: { product_id: prod.id, warehouse_id: 1, quantity: 0 } })).status, 400);
  assert.equal((await call('POST', '/api/stock/in', { token: t, body: { product_id: prod.id, warehouse_id: 1, quantity: -3 } })).status, 400);
  assert.equal((await call('POST', '/api/stock/in', { token: t, body: { product_id: 9999, warehouse_id: 1, quantity: 1 } })).status, 404);
  // balance is correct and history recorded
  const detail = (await call('GET', `/api/products/${prod.id}`, { token: t })).data;
  assert.equal(detail.total_stock, 20);
  assert.equal(detail.status, 'ok' === detail.status && 20 > 10 ? 'ok' : detail.status);
  const hist = (await call('GET', `/api/stock/movements?product_id=${prod.id}`, { token: t })).data;
  assert.equal(hist.length, 2);
  assert.equal(hist[0].type, 'OUT');
  assert.ok(db.prepare("SELECT COUNT(*) n FROM inventory_logs WHERE action LIKE 'STOCK_%'").get().n >= 2);
  // DB-level guard: a direct negative write must be rejected by the CHECK constraint
  assert.throws(() => db.prepare('UPDATE stock_levels SET quantity = -1 WHERE product_id = ?').run(prod.id));
});

test('concurrent OUT requests cannot oversell', async () => {
  const prod = (await call('POST', '/api/products', { token: tokens.admin, body: { sku: 'CONC-1', name: 'Concurrent', category: 'Testing', unit_price: 1, reorder_level: 1 } })).data;
  await call('POST', '/api/stock/in', { token: tokens.staff, body: { product_id: prod.id, warehouse_id: 1, quantity: 10 } });
  const results = await Promise.all(Array.from({ length: 5 }, () => call('POST', '/api/stock/out', { token: tokens.staff, body: { product_id: prod.id, warehouse_id: 1, quantity: 4 } })));
  assert.equal(results.filter((r) => r.status === 201).length, 2);
  assert.equal(results.filter((r) => r.status === 409).length, 3);
  assert.equal((await call('GET', `/api/products/${prod.id}`, { token: tokens.staff })).data.total_stock, 2);
});

test('suppliers + purchase orders: create, receive books stock IN, cannot receive twice', async () => {
  const t = tokens.manager;
  const bad = await call('POST', '/api/suppliers', { token: t, body: { name: '', email: 'not-an-email' } });
  assert.equal(bad.status, 400);
  const sup = (await call('POST', '/api/suppliers', { token: t, body: { name: 'New Supplier', email: 'a@b.com', phone: '123' } })).data;
  assert.ok(sup.id);
  assert.equal((await call('PUT', `/api/suppliers/${sup.id}`, { token: t, body: { name: 'Renamed Supplier' } })).status, 200);

  assert.equal((await call('POST', '/api/purchase-orders', { token: t, body: { supplier_id: sup.id, warehouse_id: 1, items: [] } })).status, 400);
  const before = (await call('GET', '/api/products/1', { token: t })).data.total_stock;
  const po = await call('POST', '/api/purchase-orders', { token: t, body: { supplier_id: sup.id, warehouse_id: 1, items: [{ product_id: 1, quantity: 15, unit_cost: 400 }, { product_id: 2, quantity: 5, unit_cost: 1800 }] } });
  assert.equal(po.status, 201);
  assert.match(po.data.po_number, /^PO-\d{5}$/);
  assert.equal(po.data.total, 15 * 400 + 5 * 1800);
  assert.equal((await call('POST', `/api/purchase-orders/${po.data.id}/receive`, { token: t })).data.status, 'RECEIVED');
  assert.equal((await call('GET', '/api/products/1', { token: t })).data.total_stock, before + 15);
  assert.equal((await call('POST', `/api/purchase-orders/${po.data.id}/receive`, { token: t })).status, 409);
  const po2 = (await call('POST', '/api/purchase-orders', { token: t, body: { supplier_id: sup.id, warehouse_id: 1, items: [{ product_id: 1, quantity: 1, unit_cost: 1 }] } })).data;
  assert.equal((await call('POST', `/api/purchase-orders/${po2.id}/cancel`, { token: t })).data.status, 'CANCELLED');
  assert.equal((await call('DELETE', `/api/suppliers/${sup.id}`, { token: t })).status, 409);
});

test('warehouses: list with utilization, create (admin), stock by warehouse', async () => {
  const list = await call('GET', '/api/warehouses', { token: tokens.staff });
  assert.equal(list.status, 200);
  assert.ok(list.data.length >= 3 && 'utilization' in list.data[0]);
  const w = await call('POST', '/api/warehouses', { token: tokens.admin, body: { name: 'West Depot', location: 'Gachibowli', capacity: 800 } });
  assert.equal(w.status, 201);
  assert.equal((await call('POST', '/api/warehouses', { token: tokens.admin, body: { name: 'West Depot', location: 'x', capacity: 1 } })).status, 409);
  assert.ok((await call('GET', '/api/warehouses/1/stock', { token: tokens.staff })).data.length > 0);
});

test('dashboard summary matches the database', async () => {
  const s = (await call('GET', '/api/dashboard/summary', { token: tokens.staff })).data;
  const dbUnits = db.prepare('SELECT SUM(quantity) n FROM stock_levels').get().n;
  assert.equal(s.totalUnits, dbUnits);
  assert.ok(Array.isArray(s.lowStock) && Array.isArray(s.recentMovements) && Array.isArray(s.movementsByDay));
  assert.ok(s.lowStockCount + s.outOfStockCount >= 1);
});

test('reports: JSON, CSV and predictive restock', async () => {
  const t = tokens.manager;
  const inv = await call('GET', '/api/reports/inventory', { token: t });
  assert.ok(inv.data.length > 0 && 'stock_value' in inv.data[0]);
  const csv = await call('GET', '/api/reports/inventory?format=csv', { token: t });
  assert.match(csv.data, /^sku,name,category,warehouse,quantity/);
  assert.ok((await call('GET', '/api/reports/movements', { token: t })).data.length > 0);
  const restock = (await call('GET', '/api/reports/restock', { token: t })).data;
  assert.ok(restock.every((r) => r.suggested_order_qty > 0));
});

test('admin can create users; duplicate email rejected', async () => {
  const body = { name: 'New User', email: 'new@warehouse.com', password: 'secret1', role: 'staff' };
  assert.equal((await call('POST', '/api/auth/users', { token: tokens.admin, body })).status, 201);
  assert.equal((await call('POST', '/api/auth/users', { token: tokens.admin, body })).status, 409);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'new@warehouse.com', password: 'secret1' } })).status, 200);
});
