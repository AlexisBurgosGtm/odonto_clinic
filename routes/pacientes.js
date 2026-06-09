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
      `SELECT CODPACIENTE, EMPNIT, NOMBRE, DIRECCION, TELEFONOS, EMAIL, NACIMIENTO
       FROM pacientes
       WHERE EMPNIT = ?
       ORDER BY NOMBRE`,
      [empnit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar pacientes:', error.message);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
});

router.get('/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT CODPACIENTE, EMPNIT, NOMBRE, DIRECCION, TELEFONOS, EMAIL, NACIMIENTO
       FROM pacientes
       WHERE CODPACIENTE = ? AND EMPNIT = ?`,
      [req.params.codpaciente, empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener paciente:', error.message);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { NOMBRE, DIRECCION, TELEFONOS, EMAIL, NACIMIENTO } = req.body;

  if (!NOMBRE?.trim()) {
    return res.status(400).json({ error: 'El nombre del paciente es requerido' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO pacientes (EMPNIT, NOMBRE, DIRECCION, TELEFONOS, EMAIL, NACIMIENTO)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        empnit,
        NOMBRE.trim(),
        DIRECCION?.trim() || null,
        TELEFONOS?.trim() || null,
        EMAIL?.trim() || null,
        NACIMIENTO || null,
      ]
    );

    res.status(201).json({
      CODPACIENTE: result.insertId,
      EMPNIT: empnit,
      NOMBRE: NOMBRE.trim(),
      DIRECCION: DIRECCION?.trim() || null,
      TELEFONOS: TELEFONOS?.trim() || null,
      EMAIL: EMAIL?.trim() || null,
      NACIMIENTO: NACIMIENTO || null,
    });
  } catch (error) {
    console.error('Error al crear paciente:', error.message);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
});

router.put('/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { NOMBRE, DIRECCION, TELEFONOS, EMAIL, NACIMIENTO } = req.body;

  if (!NOMBRE?.trim()) {
    return res.status(400).json({ error: 'El nombre del paciente es requerido' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE pacientes
       SET NOMBRE = ?, DIRECCION = ?, TELEFONOS = ?, EMAIL = ?, NACIMIENTO = ?
       WHERE CODPACIENTE = ? AND EMPNIT = ?`,
      [
        NOMBRE.trim(),
        DIRECCION?.trim() || null,
        TELEFONOS?.trim() || null,
        EMAIL?.trim() || null,
        NACIMIENTO || null,
        req.params.codpaciente,
        empnit,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json({ message: 'Paciente actualizado' });
  } catch (error) {
    console.error('Error al actualizar paciente:', error.message);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
});

router.delete('/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM pacientes WHERE CODPACIENTE = ? AND EMPNIT = ?',
      [req.params.codpaciente, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    res.json({ message: 'Paciente eliminado' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error.message);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
});

module.exports = router;
