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

  const { start, end } = req.query;

  try {
    let sql = `
      SELECT a.ID, a.EMPNIT, a.CODPACIENTE, a.CODEMP, a.MOTIVO, a.OBS, a.FECHA, a.FECHA_FIN,
             e.EMPLEADO AS MEDICO, e.COLOR,
             p.NOMBRE AS PACIENTE, p.NACIMIENTO
      FROM agenda a
      LEFT JOIN empleados e ON e.CODEMP = a.CODEMP AND e.EMPNIT = a.EMPNIT
      LEFT JOIN pacientes p ON p.CODPACIENTE = a.CODPACIENTE AND p.EMPNIT = a.EMPNIT
      WHERE a.EMPNIT = ?
    `;
    const params = [empnit];

    if (start && end) {
      sql += ' AND a.FECHA >= ? AND a.FECHA <= ?';
      params.push(start, end);
    }

    sql += ' ORDER BY a.FECHA';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar agenda:', error.message);
    res.status(500).json({ error: 'Error al obtener agenda' });
  }
});

router.get('/paciente/:codpaciente/proxima', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT a.ID, a.FECHA, a.FECHA_FIN, a.MOTIVO, e.EMPLEADO AS MEDICO
       FROM agenda a
       LEFT JOIN empleados e ON e.CODEMP = a.CODEMP AND e.EMPNIT = a.EMPNIT
       WHERE a.EMPNIT = ? AND a.CODPACIENTE = ? AND a.FECHA >= NOW()
       ORDER BY a.FECHA ASC
       LIMIT 1`,
      [empnit, req.params.codpaciente]
    );

    res.json(rows[0] || null);
  } catch (error) {
    console.error('Error al obtener próxima cita:', error.message);
    res.status(500).json({ error: 'Error al obtener la próxima cita' });
  }
});

router.get('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT a.ID, a.EMPNIT, a.CODPACIENTE, a.CODEMP, a.MOTIVO, a.OBS, a.FECHA, a.FECHA_FIN,
              e.EMPLEADO AS MEDICO, e.COLOR,
              p.NOMBRE AS PACIENTE, p.NACIMIENTO
       FROM agenda a
       LEFT JOIN empleados e ON e.CODEMP = a.CODEMP AND e.EMPNIT = a.EMPNIT
       LEFT JOIN pacientes p ON p.CODPACIENTE = a.CODPACIENTE AND p.EMPNIT = a.EMPNIT
       WHERE a.ID = ? AND a.EMPNIT = ?`,
      [req.params.id, empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener evento:', error.message);
    res.status(500).json({ error: 'Error al obtener evento' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, CODEMP, MOTIVO, OBS, FECHA, FECHA_FIN } = req.body;

  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  if (!FECHA_FIN) {
    return res.status(400).json({ error: 'La hora final es requerida' });
  }

  if (FECHA_FIN <= FECHA) {
    return res.status(400).json({ error: 'La hora final debe ser posterior a la hora de inicio' });
  }

  if (!CODEMP) {
    return res.status(400).json({ error: 'Debe seleccionar un médico' });
  }

  try {
    const [medico] = await pool.query(
      `SELECT CODEMP FROM empleados
       WHERE CODEMP = ? AND EMPNIT = ? AND TIPO = 'MEDICO'`,
      [CODEMP, empnit]
    );

    if (medico.length === 0) {
      return res.status(400).json({ error: 'El médico seleccionado no es válido' });
    }

    const [result] = await pool.query(
      `INSERT INTO agenda (EMPNIT, CODPACIENTE, CODEMP, MOTIVO, OBS, FECHA, FECHA_FIN)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        empnit,
        CODPACIENTE || null,
        CODEMP,
        MOTIVO?.trim() || null,
        OBS?.trim() || null,
        FECHA,
        FECHA_FIN,
      ]
    );

    res.status(201).json({ ID: result.insertId, message: 'Evento creado' });
  } catch (error) {
    console.error('Error al crear evento:', error.message);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, CODEMP, MOTIVO, OBS, FECHA, FECHA_FIN } = req.body;

  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  if (!FECHA_FIN) {
    return res.status(400).json({ error: 'La hora final es requerida' });
  }

  if (FECHA_FIN <= FECHA) {
    return res.status(400).json({ error: 'La hora final debe ser posterior a la hora de inicio' });
  }

  if (!CODEMP) {
    return res.status(400).json({ error: 'Debe seleccionar un médico' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE agenda
       SET CODPACIENTE = ?, CODEMP = ?, MOTIVO = ?, OBS = ?, FECHA = ?, FECHA_FIN = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [
        CODPACIENTE || null,
        CODEMP,
        MOTIVO?.trim() || null,
        OBS?.trim() || null,
        FECHA,
        FECHA_FIN,
        req.params.id,
        empnit,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json({ message: 'Evento actualizado' });
  } catch (error) {
    console.error('Error al actualizar evento:', error.message);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM agenda WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json({ message: 'Evento eliminado' });
  } catch (error) {
    console.error('Error al eliminar evento:', error.message);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

module.exports = router;
