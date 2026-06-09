const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT PIEZA FROM piezas
       WHERE PIEZA IS NOT NULL AND PIEZA <> ''
       ORDER BY
         CASE WHEN PIEZA REGEXP '^[0-9]+$' THEN 0 ELSE 1 END,
         CAST(PIEZA AS UNSIGNED),
         PIEZA`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar piezas:', error.message);
    res.status(500).json({ error: 'Error al obtener piezas' });
  }
});

module.exports = router;
