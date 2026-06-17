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

function parseMesAnio(req, res) {
  const mes = Number(req.query.mes);
  const anio = Number(req.query.anio);

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    res.status(400).json({ error: 'El mes debe estar entre 1 y 12' });
    return null;
  }

  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    res.status(400).json({ error: 'El año no es válido' });
    return null;
  }

  return { mes, anio };
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const periodo = parseMesAnio(req, res);
  if (!periodo) return;

  const { mes, anio } = periodo;

  try {
    const [rows] = await pool.query(
      `SELECT g.ID, g.EMPNIT, g.CODTIPO, g.FECHA, g.DESCRIPCION, g.IMPORTE,
              gt.TIPO
       FROM gastos g
       LEFT JOIN gastos_tipos gt ON gt.CODTIPO = g.CODTIPO
       WHERE g.EMPNIT = ? AND YEAR(g.FECHA) = ? AND MONTH(g.FECHA) = ?
       ORDER BY g.FECHA DESC, g.ID DESC`,
      [empnit, anio, mes]
    );

    const total = rows.reduce((sum, row) => sum + (Number(row.IMPORTE) || 0), 0);

    res.json({
      mes,
      anio,
      total,
      gastos: rows,
    });
  } catch (error) {
    console.error('Error al listar gastos:', error.message);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODTIPO, FECHA, DESCRIPCION, IMPORTE } = req.body;

  if (!CODTIPO) {
    return res.status(400).json({ error: 'El tipo de gasto es requerido' });
  }

  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  const importe = Number(IMPORTE);
  if (!importe || importe <= 0) {
    return res.status(400).json({ error: 'El importe debe ser mayor a cero' });
  }

  try {
    const [tipoRows] = await pool.query(
      'SELECT CODTIPO FROM gastos_tipos WHERE CODTIPO = ?',
      [CODTIPO]
    );

    if (tipoRows.length === 0) {
      return res.status(400).json({ error: 'El tipo de gasto seleccionado no existe' });
    }

    const [result] = await pool.query(
      `INSERT INTO gastos (EMPNIT, CODTIPO, FECHA, DESCRIPCION, IMPORTE)
       VALUES (?, ?, ?, ?, ?)`,
      [empnit, CODTIPO, FECHA, DESCRIPCION?.trim() || null, importe]
    );

    res.status(201).json({
      ID: result.insertId,
      EMPNIT: empnit,
      CODTIPO,
      FECHA,
      DESCRIPCION: DESCRIPCION?.trim() || null,
      IMPORTE: importe,
    });
  } catch (error) {
    console.error('Error al crear gasto:', error.message);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODTIPO, FECHA, DESCRIPCION, IMPORTE } = req.body;

  if (!CODTIPO) {
    return res.status(400).json({ error: 'El tipo de gasto es requerido' });
  }

  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  const importe = Number(IMPORTE);
  if (!importe || importe <= 0) {
    return res.status(400).json({ error: 'El importe debe ser mayor a cero' });
  }

  try {
    const [tipoRows] = await pool.query(
      'SELECT CODTIPO FROM gastos_tipos WHERE CODTIPO = ?',
      [CODTIPO]
    );

    if (tipoRows.length === 0) {
      return res.status(400).json({ error: 'El tipo de gasto seleccionado no existe' });
    }

    const [result] = await pool.query(
      `UPDATE gastos
       SET CODTIPO = ?, FECHA = ?, DESCRIPCION = ?, IMPORTE = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [CODTIPO, FECHA, DESCRIPCION?.trim() || null, importe, req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ message: 'Gasto actualizado' });
  } catch (error) {
    console.error('Error al actualizar gasto:', error.message);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM gastos WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ message: 'Gasto eliminado' });
  } catch (error) {
    console.error('Error al eliminar gasto:', error.message);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
