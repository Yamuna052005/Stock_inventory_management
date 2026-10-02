const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(process.env.DB_PATH || './data/warehouse.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  const dir = path.join(__dirname, '..', 'migrations');
  fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().forEach((f) => {
    db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  });
}
migrate();

module.exports = { db, migrate, dbPath };
