const { pool } = require('../db/mysql');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.total) > 0;
}

async function ensureColumn(table, column, definition) {
  if (await columnExists(table, column)) return;
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureEmpresas() {
  await ensureColumn('empresas', 'DIRECCION', 'VARCHAR(500) NULL');
  await ensureColumn('empresas', 'TELEFONOS', 'VARCHAR(100) NULL');
}

module.exports = { ensureEmpresas };
