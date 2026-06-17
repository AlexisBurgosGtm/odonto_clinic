const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT CODTIPO, TIPO FROM gastos_tipos ORDER BY TIPO'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar tipos de gasto:', error.message);
    res.status(500).json({ error: 'Error al obtener tipos de gasto' });
  }
});

router.post('/', async (req, res) => {
  const { TIPO } = req.body;

  if (!TIPO?.trim()) {
    return res.status(400).json({ error: 'El nombre del tipo de gasto es requerido' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO gastos_tipos (TIPO) VALUES (?)',
      [TIPO.trim()]
    );

    res.status(201).json({
      CODTIPO: result.insertId,
      TIPO: TIPO.trim(),
    });
  } catch (error) {
    console.error('Error al crear tipo de gasto:', error.message);
    res.status(500).json({ error: 'Error al crear tipo de gasto' });
  }
});

router.put('/:codtipo', async (req, res) => {
  const { TIPO } = req.body;

  if (!TIPO?.trim()) {
    return res.status(400).json({ error: 'El nombre del tipo de gasto es requerido' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE gastos_tipos SET TIPO = ? WHERE CODTIPO = ?',
      [TIPO.trim(), req.params.codtipo]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de gasto no encontrado' });
    }

    res.json({ CODTIPO: Number(req.params.codtipo), TIPO: TIPO.trim() });
  } catch (error) {
    console.error('Error al actualizar tipo de gasto:', error.message);
    res.status(500).json({ error: 'Error al actualizar tipo de gasto' });
  }
});

router.delete('/:codtipo', async (req, res) => {
  try {
    const [enUso] = await pool.query(
      'SELECT COUNT(*) AS total FROM gastos WHERE CODTIPO = ?',
      [req.params.codtipo]
    );

    if (enUso[0].total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar: el tipo está asociado a gastos registrados',
      });
    }

    const [result] = await pool.query(
      'DELETE FROM gastos_tipos WHERE CODTIPO = ?',
      [req.params.codtipo]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de gasto no encontrado' });
    }

    res.json({ message: 'Tipo de gasto eliminado' });
  } catch (error) {
    console.error('Error al eliminar tipo de gasto:', error.message);
    res.status(500).json({ error: 'Error al eliminar tipo de gasto' });
  }
});

module.exports = router;
