const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT ID, EMPNIT, CODPROD, DESPROD, PRECIO
       FROM productos
       WHERE EMPNIT = ?
       ORDER BY DESPROD`,
      [empnit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar productos:', error.message);
    res.status(500).json({ error: 'Error al obtener tratamientos' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPROD, DESPROD, PRECIO } = req.body;

  if (!CODPROD?.trim()) {
    return res.status(400).json({ error: 'El código del tratamiento es requerido' });
  }

  if (!DESPROD?.trim()) {
    return res.status(400).json({ error: 'El nombre del tratamiento es requerido' });
  }

  try {
    const [existente] = await pool.query(
      'SELECT ID FROM productos WHERE EMPNIT = ? AND CODPROD = ?',
      [empnit, CODPROD.trim()]
    );

    if (existente.length > 0) {
      return res.status(409).json({ error: 'Ya existe un tratamiento con ese código en esta empresa' });
    }

    const [result] = await pool.query(
      `INSERT INTO productos (EMPNIT, CODPROD, DESPROD, PRECIO)
       VALUES (?, ?, ?, ?)`,
      [empnit, CODPROD.trim(), DESPROD.trim(), PRECIO ?? null]
    );

    res.status(201).json({
      ID: result.insertId,
      EMPNIT: empnit,
      CODPROD: CODPROD.trim(),
      DESPROD: DESPROD.trim(),
      PRECIO: PRECIO ?? null,
    });
  } catch (error) {
    console.error('Error al crear producto:', error.message);
    res.status(500).json({ error: 'Error al crear tratamiento' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { DESPROD, PRECIO } = req.body;

  if (!DESPROD?.trim()) {
    return res.status(400).json({ error: 'El nombre del tratamiento es requerido' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE productos SET DESPROD = ?, PRECIO = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [DESPROD.trim(), PRECIO ?? null, req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json({ message: 'Tratamiento actualizado' });
  } catch (error) {
    console.error('Error al actualizar producto:', error.message);
    res.status(500).json({ error: 'Error al actualizar tratamiento' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM productos WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json({ message: 'Tratamiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error.message);
    res.status(500).json({ error: 'Error al eliminar tratamiento' });
  }
});

module.exports = router;
