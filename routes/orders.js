const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const ORDER_FIELDS = [
  'ID', 'EMPNIT', 'CODPACIENTE', 'CODEMP', 'FECHA', 'PIEZA', 'CODPROD', 'DESPROD',
  'REALIZADO', 'FECHA_REALIZADO', 'OBS', 'PRECIO', 'PRECIO_FINAL',
];

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/paciente/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT ${ORDER_FIELDS.join(', ')}
       FROM orders
       WHERE EMPNIT = ? AND CODPACIENTE = ?
       ORDER BY FECHA ASC, ID ASC`,
      [empnit, req.params.codpaciente]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar órdenes:', error.message);
    res.status(500).json({ error: 'Error al obtener tratamientos del paciente' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, PIEZA, CODPROD, DESPROD, PRECIO, FECHA, OBS } = req.body;

  if (!CODPACIENTE) {
    return res.status(400).json({ error: 'El paciente es requerido' });
  }

  if (!PIEZA?.trim()) {
    return res.status(400).json({ error: 'La pieza es requerida' });
  }

  if (!CODPROD?.trim()) {
    return res.status(400).json({ error: 'El tratamiento es requerido' });
  }

  if (PRECIO === undefined || PRECIO === null || PRECIO === '') {
    return res.status(400).json({ error: 'El precio es requerido' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO orders (EMPNIT, CODPACIENTE, FECHA, PIEZA, CODPROD, DESPROD, PRECIO, OBS, REALIZADO)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NO')`,
      [
        empnit,
        CODPACIENTE,
        FECHA || todayDate(),
        PIEZA.trim(),
        CODPROD.trim(),
        DESPROD?.trim() || null,
        PRECIO,
        OBS?.trim() || null,
      ]
    );

    res.status(201).json({
      ID: result.insertId,
      EMPNIT: empnit,
      CODPACIENTE,
      FECHA: FECHA || todayDate(),
      PIEZA: PIEZA.trim(),
      CODPROD: CODPROD.trim(),
      DESPROD: DESPROD?.trim() || null,
      PRECIO,
      OBS: OBS?.trim() || null,
      REALIZADO: 'NO',
    });
  } catch (error) {
    console.error('Error al crear orden:', error.message);
    res.status(500).json({ error: 'Error al agregar tratamiento' });
  }
});

router.put('/:id/finalizar', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { FECHA_REALIZADO, PRECIO_FINAL, CODEMP } = req.body;

  if (!FECHA_REALIZADO) {
    return res.status(400).json({ error: 'La fecha de realización es requerida' });
  }

  if (PRECIO_FINAL === undefined || PRECIO_FINAL === null || PRECIO_FINAL === '') {
    return res.status(400).json({ error: 'El precio final es requerido' });
  }

  if (!CODEMP) {
    return res.status(400).json({ error: 'El médico es requerido' });
  }

  try {
    const [medico] = await pool.query(
      `SELECT CODEMP FROM empleados
       WHERE CODEMP = ? AND EMPNIT = ? AND TIPO = 'MEDICO' AND HABILITADO = 'SI'`,
      [CODEMP, empnit]
    );

    if (medico.length === 0) {
      return res.status(400).json({ error: 'El médico seleccionado no es válido' });
    }

    const [result] = await pool.query(
      `UPDATE orders
       SET REALIZADO = 'SI', FECHA_REALIZADO = ?, PRECIO_FINAL = ?, CODEMP = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [FECHA_REALIZADO, PRECIO_FINAL, CODEMP, req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json({ message: 'Tratamiento finalizado' });
  } catch (error) {
    console.error('Error al finalizar orden:', error.message);
    res.status(500).json({ error: 'Error al finalizar tratamiento' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { PIEZA, PRECIO } = req.body;

  if (!PIEZA?.trim()) {
    return res.status(400).json({ error: 'La pieza es requerida' });
  }

  if (PRECIO === undefined || PRECIO === null || PRECIO === '') {
    return res.status(400).json({ error: 'El precio es requerido' });
  }

  try {
    const [existente] = await pool.query(
      'SELECT ID, REALIZADO FROM orders WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (existente.length === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    if (existente[0].REALIZADO === 'SI') {
      return res.status(400).json({ error: 'No se puede editar un tratamiento finalizado' });
    }

    const [result] = await pool.query(
      `UPDATE orders SET PIEZA = ?, PRECIO = ? WHERE ID = ? AND EMPNIT = ?`,
      [PIEZA.trim(), PRECIO, req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json({ message: 'Tratamiento actualizado' });
  } catch (error) {
    console.error('Error al actualizar orden:', error.message);
    res.status(500).json({ error: 'Error al actualizar tratamiento' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM orders WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }

    res.json({ message: 'Tratamiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar orden:', error.message);
    res.status(500).json({ error: 'Error al eliminar tratamiento' });
  }
});

module.exports = router;
