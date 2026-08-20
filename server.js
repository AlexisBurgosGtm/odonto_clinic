require('dotenv').config();

const express = require('express');
const path = require('path');
const { pool, testConnection } = require('./db/mysql');
const { ensureFelTables } = require('./lib/ensure-fel-tables');
const { ensureOdontograma } = require('./lib/ensure-odontograma');
const { ensureEmpresas } = require('./lib/ensure-empresas');

const app = express();
const PORT = process.env.PORT || 8005;
const PUBLIC_DIR = path.join(__dirname);

app.use(express.json({ limit: '3mb' }));
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  index: 'index.html',
}));

app.get('/api/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/empresas', require('./routes/empresas'));
app.use('/api/empleados', require('./routes/empleados'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/piezas', require('./routes/piezas'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/transacciones', require('./routes/transacciones'));
app.use('/api/gastos-tipos', require('./routes/gastos-tipos'));
app.use('/api/config-recetas', require('./routes/config-recetas'));
app.use('/api/recetas', require('./routes/recetas'));
app.use('/api/gastos', require('./routes/gastos'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/config', require('./routes/config'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/credenciales-fel', require('./routes/credenciales-fel'));
app.use('/api/odontograma', require('./routes/odontograma'));

app.get('/manifest.webmanifest', (_req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(PUBLIC_DIR, 'manifest.webmanifest'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function startServer() {
  try {
    await testConnection();
    await ensureFelTables();
    await ensureOdontograma();
    await ensureEmpresas();
    console.log(`MySQL conectado — ${process.env.DB_HOST}/${process.env.DB_DATABASE}`);
  } catch (error) {
    console.error('Error al conectar con MySQL:', error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Clínica Dental — http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

startServer();
