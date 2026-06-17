const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const CONFIG_MAX_LENGTH = {
  CUMPLE: 700,
  DISCLAIMER: 3000,
};

function getConfigMaxLength(tipo) {
  return CONFIG_MAX_LENGTH[tipo] || 700;
}

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

router.get('/:tipo', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const tipo = String(req.params.tipo || '').trim().toUpperCase();
  if (!tipo) {
    return res.status(400).json({ error: 'TIPO es requerido' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT ID, TIPO, DETALLES, VALOR FROM config WHERE TIPO = ?',
      [tipo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener configuración:', error.message);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

router.put('/:tipo', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const tipo = String(req.params.tipo || '').trim().toUpperCase();
  if (!tipo) {
    return res.status(400).json({ error: 'TIPO es requerido' });
  }

  const detalles = req.body?.DETALLES != null ? String(req.body.DETALLES).trim() : '';

  if (tipo !== 'DISCLAIMER' && !detalles) {
    return res.status(400).json({ error: 'DETALLES es requerido' });
  }

  const maxLength = getConfigMaxLength(tipo);
  if (detalles.length > maxLength) {
    return res.status(400).json({ error: `El texto no puede superar ${maxLength} caracteres` });
  }

  try {
    const [existing] = await pool.query('SELECT ID FROM config WHERE TIPO = ?', [tipo]);

    if (existing.length === 0) {
      await pool.query('INSERT INTO config (TIPO, DETALLES) VALUES (?, ?)', [tipo, detalles]);
    } else {
      await pool.query('UPDATE config SET DETALLES = ? WHERE TIPO = ?', [detalles, tipo]);
    }

    res.json({ TIPO: tipo, DETALLES: detalles });
  } catch (error) {
    console.error('Error al actualizar configuración:', error.message);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;
