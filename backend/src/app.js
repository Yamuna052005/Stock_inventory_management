const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/auth');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/products', authenticate, require('./routes/products'));
  app.use('/api/stock', authenticate, require('./routes/stock'));
  app.use('/api/suppliers', authenticate, require('./routes/suppliers'));
  app.use('/api/warehouses', authenticate, require('./routes/warehouses'));
  app.use('/api/purchase-orders', authenticate, require('./routes/purchaseOrders'));
  app.use('/api/dashboard', authenticate, require('./routes/dashboard'));
  app.use('/api/reports', authenticate, require('./routes/reports'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

  // Serve the built React app when present (single-service deployment)
  const dist = path.resolve(__dirname, '..', process.env.FRONTEND_DIST || '../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err, req, res, next) => { // eslint-disable-line
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    const status = err.status || (err.code && String(err.code).startsWith('SQLITE_CONSTRAINT') ? 409 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message, details: err.details });
  });
  return app;
}
module.exports = { createApp };
