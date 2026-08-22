const { pool } = require('../db/mysql');
const { getAllPiezasCatalog, LETTER_TO_FDI } = require('./odontograma-piezas');

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

async function migrateLetterPiezaInOdontograma(from, to) {
  const [conflicts] = await pool.query(
    `SELECT o1.ID AS oldId
     FROM odontograma o1
     INNER JOIN odontograma o2
       ON o2.EMPNIT = o1.EMPNIT
      AND o2.CODPACIENTE = o1.CODPACIENTE
      AND o2.PIEZA = ?
     WHERE UPPER(TRIM(o1.PIEZA)) = ?`,
    [to, from]
  );

  for (const row of conflicts) {
    await pool.query('DELETE FROM odontograma WHERE ID = ?', [row.oldId]);
  }

  await pool.query(
    'UPDATE odontograma SET PIEZA = ? WHERE UPPER(TRIM(PIEZA)) = ?',
    [to, from]
  );
}

async function migrateLetterPiezasToFdi() {
  for (const [from, to] of Object.entries(LETTER_TO_FDI)) {
    await migrateLetterPiezaInOdontograma(from, to);
    await pool.query('UPDATE orders SET PIEZA = ? WHERE UPPER(TRIM(PIEZA)) = ?', [to, from]);

    const [existing] = await pool.query(
      'SELECT PIEZA FROM piezas WHERE PIEZA = ? LIMIT 1',
      [to]
    );
    if (existing.length === 0) {
      await pool.query('INSERT INTO piezas (PIEZA) VALUES (?)', [to]);
    }

    await pool.query('DELETE FROM piezas WHERE UPPER(TRIM(PIEZA)) = ?', [from]);
  }
}

async function ensureOdontograma() {
  await ensurePacienteTipoColumn();
  await ensureOdontogramaTable();
  await ensurePiezasCatalog();
  await migrateLetterPiezasToFdi();
}

module.exports = {
  ensureOdontograma,
};
