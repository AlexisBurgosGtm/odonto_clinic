const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const CATEGORIAS = ['CIRUGIA QUIRUGICA', 'EXODONCIA', 'ENDODONCIA', 'OTROS'];
const TIPOS = ['MEDICAMENTO', 'INDICACIONES'];

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

function normalizeCategoria(value) {
  const cat = String(value || '').trim().toUpperCase();
  return CATEGORIAS.includes(cat) ? cat : null;
}

function normalizeTipo(value) {
  const tipo = String(value || '').trim().toUpperCase();
  return TIPOS.includes(tipo) ? tipo : null;
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT ID, EMPNIT, CATEGORIA, TIPO, DESCRIPCION
       FROM config_recetas
       WHERE EMPNIT = ?
       ORDER BY CATEGORIA, TIPO, DESCRIPCION`,
      [empnit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar config_recetas:', error.message);
    res.status(500).json({ error: 'Error al obtener recetas de configuración' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const CATEGORIA = normalizeCategoria(req.body?.CATEGORIA);
  const TIPO = normalizeTipo(req.body?.TIPO);
  const DESCRIPCION = req.body?.DESCRIPCION != null ? String(req.body.DESCRIPCION).trim() : '';

  if (!CATEGORIA) {
    return res.status(400).json({ error: 'La categoría es requerida' });
  }
  if (!TIPO) {
    return res.status(400).json({ error: 'El tipo es requerido' });
  }
  if (!DESCRIPCION) {
    return res.status(400).json({ error: 'La descripción es requerida' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO config_recetas (EMPNIT, CATEGORIA, TIPO, DESCRIPCION)
       VALUES (?, ?, ?, ?)`,
      [empnit, CATEGORIA, TIPO, DESCRIPCION]
    );

    res.status(201).json({
      ID: result.insertId,
      EMPNIT: empnit,
      CATEGORIA,
      TIPO,
      DESCRIPCION,
    });
  } catch (error) {
    console.error('Error al crear config_recetas:', error.message);
    res.status(500).json({ error: 'Error al crear registro de receta' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const CATEGORIA = normalizeCategoria(req.body?.CATEGORIA);
  const TIPO = normalizeTipo(req.body?.TIPO);
  const DESCRIPCION = req.body?.DESCRIPCION != null ? String(req.body.DESCRIPCION).trim() : '';

  if (!CATEGORIA) {
    return res.status(400).json({ error: 'La categoría es requerida' });
  }
  if (!TIPO) {
    return res.status(400).json({ error: 'El tipo es requerido' });
  }
  if (!DESCRIPCION) {
    return res.status(400).json({ error: 'La descripción es requerida' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE config_recetas
       SET CATEGORIA = ?, TIPO = ?, DESCRIPCION = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [CATEGORIA, TIPO, DESCRIPCION, req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro de receta no encontrado' });
    }

    res.json({
      ID: Number(req.params.id),
      EMPNIT: empnit,
      CATEGORIA,
      TIPO,
      DESCRIPCION,
    });
  } catch (error) {
    console.error('Error al actualizar config_recetas:', error.message);
    res.status(500).json({ error: 'Error al actualizar registro de receta' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM config_recetas WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro de receta no encontrado' });
    }

    res.json({ message: 'Registro de receta eliminado' });
  } catch (error) {
    console.error('Error al eliminar config_recetas:', error.message);
    res.status(500).json({ error: 'Error al eliminar registro de receta' });
  }
});

module.exports = router;
