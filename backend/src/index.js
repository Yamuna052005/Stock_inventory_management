require('dotenv').config();
const { createApp } = require('./app');
const { db } = require('./db');

// Auto-seed on first run so the app is usable immediately
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) require('./seed').seed();

const port = process.env.PORT || 5000;
createApp().listen(port, () => console.log(`Warehouse API running on http://localhost:${port}`));
