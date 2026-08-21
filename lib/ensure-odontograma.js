const { pool } = require('../db/mysql');
const { getAllPiezasCatalog } = require('./odontograma-piezas');

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

async function ensurePacienteTipoColumn() {
  const exists = await columnExists('pacientes', 'TIPO_PACIENTE');
  if (exists) return;

  await pool.query(
    `ALTER TABLE pacientes
     ADD COLUMN TIPO_PACIENTE VARCHAR(10) NULL DEFAULT 'ADULTO'`
  );
}

async function ensureOdontogramaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontograma (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      EMPNIT VARCHAR(50) NOT NULL,
      CODPACIENTE INT NOT NULL,
      PIEZA VARCHAR(10) NOT NULL,
      ESTADO VARCHAR(30) NOT NULL DEFAULT 'SANO',
      NOTA VARCHAR(500) NULL,
      FECHA_ACT DATETIME NULL,
      UNIQUE KEY uk_odontograma_pieza (EMPNIT, CODPACIENTE, PIEZA),
      INDEX idx_odontograma_paciente (EMPNIT, CODPACIENTE)
    )
  `);
}

async function ensurePiezasCatalog() {
  const needed = [...getAllPiezasCatalog(), 'TODAS'];
  for (const pieza of needed) {
    const [rows] = await pool.query(
      'SELECT PIEZA FROM piezas WHERE PIEZA = ? LIMIT 1',
      [pieza]
    );
    if (rows.length === 0) {
      await pool.query('INSERT INTO piezas (PIEZA) VALUES (?)', [pieza]);
    }
  }
}

async function ensureOdontograma() {
  await ensurePacienteTipoColumn();
  await ensureOdontogramaTable();
  await ensurePiezasCatalog();
}

module.exports = {
  ensureOdontograma,
};
