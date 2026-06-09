const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const TIPOS_VALIDOS = ['GERENTE', 'SECRETARIA', 'MEDICO'];

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

router.get('/medicos', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT CODEMP, EMPLEADO, COLOR
       FROM empleados
       WHERE EMPNIT = ? AND TIPO = 'MEDICO' AND HABILITADO = 'SI'
       ORDER BY EMPLEADO`,
      [empnit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar médicos:', error.message);
    res.status(500).json({ error: 'Error al obtener médicos' });
  }
});

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT CODEMP, EMPNIT, EMPLEADO, TELEFONO, TIPO, USUARIO, HABILITADO, COLOR
       FROM empleados
       WHERE EMPNIT = ?
       ORDER BY EMPLEADO`,
      [empnit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar empleados:', error.message);
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

router.get('/:codemp', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT CODEMP, EMPNIT, EMPLEADO, TELEFONO, TIPO, USUARIO, HABILITADO, COLOR
       FROM empleados
       WHERE CODEMP = ? AND EMPNIT = ?`,
      [req.params.codemp, empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener empleado:', error.message);
    res.status(500).json({ error: 'Error al obtener empleado' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { EMPLEADO, TELEFONO, TIPO, USUARIO, CLAVE, HABILITADO, COLOR } = req.body;

  if (!EMPLEADO?.trim()) {
    return res.status(400).json({ error: 'El nombre del empleado es requerido' });
  }

  if (TIPO && !TIPOS_VALIDOS.includes(TIPO)) {
    return res.status(400).json({ error: 'Tipo de empleado no válido' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO empleados (EMPNIT, EMPLEADO, TELEFONO, TIPO, USUARIO, CLAVE, HABILITADO, COLOR)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empnit,
        EMPLEADO.trim(),
        TELEFONO?.trim() || null,
        TIPO || null,
        USUARIO?.trim() || null,
        CLAVE || null,
        HABILITADO || 'SI',
        COLOR || '#0ea5e9',
      ]
    );

    res.status(201).json({
      CODEMP: result.insertId,
      EMPNIT: empnit,
      EMPLEADO: EMPLEADO.trim(),
      TELEFONO: TELEFONO?.trim() || null,
      TIPO: TIPO || null,
      USUARIO: USUARIO?.trim() || null,
      HABILITADO: HABILITADO || 'SI',
      COLOR: COLOR || '#0ea5e9',
    });
  } catch (error) {
    console.error('Error al crear empleado:', error.message);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

router.put('/:codemp', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { EMPLEADO, TELEFONO, TIPO, USUARIO, CLAVE, HABILITADO, COLOR } = req.body;

  if (!EMPLEADO?.trim()) {
    return res.status(400).json({ error: 'El nombre del empleado es requerido' });
  }

  if (TIPO && !TIPOS_VALIDOS.includes(TIPO)) {
    return res.status(400).json({ error: 'Tipo de empleado no válido' });
  }

  try {
    const fields = [
      'EMPLEADO = ?', 'TELEFONO = ?', 'TIPO = ?', 'USUARIO = ?',
      'HABILITADO = ?', 'COLOR = ?',
    ];
    const values = [
      EMPLEADO.trim(),
      TELEFONO?.trim() || null,
      TIPO || null,
      USUARIO?.trim() || null,
      HABILITADO || 'SI',
      COLOR || '#0ea5e9',
    ];

    if (CLAVE) {
      fields.push('CLAVE = ?');
      values.push(CLAVE);
    }

    values.push(req.params.codemp, empnit);

    const [result] = await pool.query(
      `UPDATE empleados SET ${fields.join(', ')} WHERE CODEMP = ? AND EMPNIT = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    res.json({ message: 'Empleado actualizado' });
  } catch (error) {
    console.error('Error al actualizar empleado:', error.message);
    res.status(500).json({ error: 'Error al actualizar empleado' });
  }
});

router.delete('/:codemp', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM empleados WHERE CODEMP = ? AND EMPNIT = ?',
      [req.params.codemp, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    res.json({ message: 'Empleado eliminado' });
  } catch (error) {
    console.error('Error al eliminar empleado:', error.message);
    res.status(500).json({ error: 'Error al eliminar empleado' });
  }
});

module.exports = router;
