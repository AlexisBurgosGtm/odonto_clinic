const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const PACIENTE_FIELDS = [
  'CODPACIENTE', 'EMPNIT', 'NOMBRE', 'DIRECCION', 'TELEFONOS', 'EMAIL', 'NACIMIENTO',
  'D_ALERGIAS', 'D_ASMA', 'D_HEPATITIS', 'D_ANTIBIOTICOS', 'D_VIH',
  'D_HIPERTENSION', 'D_HIPOTENSION', 'D_TUBERCULOSIS',
  'E_MEDICAMENTOS', 'E_SENSIBILIDAD_MEDICAMENTOS', 'E_DETALLES',
];

const D_FIELDS = [
  'D_ALERGIAS', 'D_ASMA', 'D_HEPATITIS', 'D_ANTIBIOTICOS', 'D_VIH',
  'D_HIPERTENSION', 'D_HIPOTENSION', 'D_TUBERCULOSIS',
];

const E_FIELDS = ['E_MEDICAMENTOS', 'E_SENSIBILIDAD_MEDICAMENTOS', 'E_DETALLES'];

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

function normalizeSiNo(value) {
  return value === 'SI' ? 'SI' : 'NO';
}

function pickPacienteBody(body) {
  const data = {
    NOMBRE: body.NOMBRE?.trim(),
    DIRECCION: body.DIRECCION?.trim() || null,
    TELEFONOS: body.TELEFONOS?.trim() || null,
    EMAIL: body.EMAIL?.trim() || null,
    NACIMIENTO: body.NACIMIENTO || null,
  };

  D_FIELDS.forEach((field) => {
    data[field] = normalizeSiNo(body[field]);
  });

  E_FIELDS.forEach((field) => {
    const value = body[field]?.trim();
    data[field] = value || null;
  });

  return data;
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT ${PACIENTE_FIELDS.join(', ')}
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
      `SELECT ${PACIENTE_FIELDS.join(', ')}
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

  const data = pickPacienteBody(req.body);

  if (!data.NOMBRE) {
    return res.status(400).json({ error: 'El nombre del paciente es requerido' });
  }

  try {
    const columns = ['EMPNIT', ...Object.keys(data)];
    const placeholders = columns.map(() => '?').join(', ');
    const values = [empnit, ...Object.values(data)];

    const [result] = await pool.query(
      `INSERT INTO pacientes (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    res.status(201).json({
      CODPACIENTE: result.insertId,
      EMPNIT: empnit,
      ...data,
    });
  } catch (error) {
    console.error('Error al crear paciente:', error.message);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
});

router.put('/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const data = pickPacienteBody(req.body);

  if (!data.NOMBRE) {
    return res.status(400).json({ error: 'El nombre del paciente es requerido' });
  }

  try {
    const assignments = Object.keys(data).map((field) => `${field} = ?`).join(', ');
    const values = [...Object.values(data), req.params.codpaciente, empnit];

    const [result] = await pool.query(
      `UPDATE pacientes SET ${assignments} WHERE CODPACIENTE = ? AND EMPNIT = ?`,
      values
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
