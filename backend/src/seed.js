require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { applyMovement } = require('./services/stock');

function seed() {
  const run = db.transaction(() => {
    const addUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
    [['Alice Admin', 'admin@warehouse.com', 'admin123', 'admin'],
     ['Mark Manager', 'manager@warehouse.com', 'manager123', 'manager'],
     ['Sam Staff', 'staff@warehouse.com', 'staff123', 'staff']]
      .forEach(([n, e, p, r]) => addUser.run(n, e, bcrypt.hashSync(p, 10), r));

    const wh = db.prepare('INSERT INTO warehouses (name,location,capacity) VALUES (?,?,?)');
    wh.run('Main Warehouse', 'Hyderabad, Telangana', 5000);
    wh.run('North Hub', 'Secunderabad, Telangana', 2500);
    wh.run('Cold Storage', 'Medchal, Telangana', 1200);

    const sup = db.prepare('INSERT INTO suppliers (name,email,phone,address) VALUES (?,?,?,?)');
    sup.run('TechSource Pvt Ltd', 'sales@techsource.example', '+91 98765 43210', 'Hitech City, Hyderabad');
    sup.run('OfficeMart', 'orders@officemart.example', '+91 91234 56789', 'Begumpet, Hyderabad');
    sup.run('FreshChain Foods', 'supply@freshchain.example', '+91 99887 76655', 'Medchal, Telangana');

    const prod = db.prepare('INSERT INTO products (sku,barcode,name,category,description,unit_price,reorder_level,supplier_id) VALUES (?,?,?,?,?,?,?,?)');
    const products = [
      ['ELEC-001', '8901000000011', 'Wireless Mouse', 'Electronics', '2.4GHz optical mouse', 599, 20, 1],
      ['ELEC-002', '8901000000028', 'Mechanical Keyboard', 'Electronics', 'Blue switch keyboard', 2499, 10, 1],
      ['ELEC-003', '8901000000035', 'USB-C Cable 1m', 'Electronics', 'Fast charging cable', 199, 50, 1],
      ['ELEC-004', '8901000000042', '24" Monitor', 'Electronics', 'Full HD IPS', 8999, 5, 1],
      ['OFF-001', '8901000000059', 'A4 Paper Ream', 'Office', '500 sheets', 320, 40, 2],
      ['OFF-002', '8901000000066', 'Ballpoint Pens (Box)', 'Office', 'Box of 50', 450, 15, 2],
      ['OFF-003', '8901000000073', 'Stapler', 'Office', 'Heavy duty', 280, 10, 2],
      ['FOOD-001', '8901000000080', 'Frozen Peas 1kg', 'Food', 'Keep frozen', 180, 25, 3],
      ['FOOD-002', '8901000000097', 'Ice Cream Tub', 'Food', 'Keep frozen', 250, 20, 3],
      ['FOOD-003', '8901000000103', 'Packaged Rice 5kg', 'Food', 'Basmati', 520, 30, 3],
    ];
    products.forEach((p) => prod.run(...p));
  });
  run();

  // Initial stock + some history, booked through the real stock service
  const u = 1;
  const mv = (productId, warehouseId, type, quantity, reference) =>
    applyMovement({ productId, warehouseId, type, quantity, reference, note: 'Seed data', userId: u });
  [[1, 1, 120], [1, 2, 40], [2, 1, 30], [3, 1, 200], [4, 1, 12], [4, 2, 4], [5, 1, 300], [6, 1, 60], [7, 2, 8],
   [8, 3, 90], [9, 3, 10], [10, 1, 150]].forEach(([p, w, q]) => mv(p, w, 'IN', q, 'OPENING'));
  [[1, 1, 30], [2, 1, 8], [3, 1, 160], [4, 1, 8], [5, 1, 120], [7, 2, 3], [9, 3, 4], [10, 1, 20]]
    .forEach(([p, w, q]) => mv(p, w, 'OUT', q, 'SO-SEED'));
  // Spread seed history over the last week so dashboard trends are meaningful
  db.prepare("UPDATE stock_movements SET created_at = datetime('now', '-' || (id % 7) || ' days', '-' || (id % 5) || ' hours')").run();
  console.log('Database seeded.');
}

module.exports = { seed };
if (require.main === module) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) console.log('Database already has data; skipping seed.');
  else seed();
}
