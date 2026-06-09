const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT EMPNIT, EMPRESA FROM empresas ORDER BY EMPRESA'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar empresas:', error.message);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

router.get('/:empnit', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT EMPNIT, EMPRESA FROM empresas WHERE EMPNIT = ?',
      [req.params.empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener empresa:', error.message);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

router.post('/', async (req, res) => {
  const { EMPNIT, EMPRESA } = req.body;

  if (!EMPNIT?.trim()) {
    return res.status(400).json({ error: 'EMPNIT es requerido' });
  }

  try {
    await pool.query(
      'INSERT INTO empresas (EMPNIT, EMPRESA) VALUES (?, ?)',
      [EMPNIT.trim(), EMPRESA?.trim() || null]
    );
    res.status(201).json({ EMPNIT: EMPNIT.trim(), EMPRESA: EMPRESA?.trim() || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una empresa con ese EMPNIT' });
    }
    console.error('Error al crear empresa:', error.message);
    res.status(500).json({ error: 'Error al crear empresa' });
  }
});

router.put('/:empnit', async (req, res) => {
  const { EMPRESA } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE empresas SET EMPRESA = ? WHERE EMPNIT = ?',
      [EMPRESA?.trim() || null, req.params.empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({ EMPNIT: req.params.empnit, EMPRESA: EMPRESA?.trim() || null });
  } catch (error) {
    console.error('Error al actualizar empresa:', error.message);
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

router.delete('/:empnit', async (req, res) => {
  try {
    const [empleados] = await pool.query(
      'SELECT COUNT(*) AS total FROM empleados WHERE EMPNIT = ?',
      [req.params.empnit]
    );

    if (empleados[0].total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar: la empresa tiene empleados asociados',
      });
    }

    const [result] = await pool.query(
      'DELETE FROM empresas WHERE EMPNIT = ?',
      [req.params.empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({ message: 'Empresa eliminada' });
  } catch (error) {
    console.error('Error al eliminar empresa:', error.message);
    res.status(500).json({ error: 'Error al eliminar empresa' });
  }
});

module.exports = router;
