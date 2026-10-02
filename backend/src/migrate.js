require('dotenv').config();
const { dbPath } = require('./db');
console.log('Migrations applied. Database:', dbPath);
