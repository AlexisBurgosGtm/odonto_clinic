const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const TIPOS_VALIDOS = ['PAGO', 'ABONO'];

const TRANSACCION_FIELDS = [
  'ID', 'EMPNIT', 'CODPACIENTE', 'FECHA', 'TIPO', 'MONTO', 'OBS',
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

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const fechaInicio = req.query.fechaInicio || todayDate();
  const fechaFin = req.query.fechaFin || todayDate();

  try {
    const [rows] = await pool.query(
      `SELECT t.ID, t.EMPNIT, t.CODPACIENTE, t.FECHA, t.TIPO, t.MONTO, t.OBS,
              p.NOMBRE AS PACIENTE
       FROM transacciones t
       LEFT JOIN pacientes p ON p.CODPACIENTE = t.CODPACIENTE AND p.EMPNIT = t.EMPNIT
       WHERE t.EMPNIT = ? AND t.FECHA >= ? AND t.FECHA <= ?
       ORDER BY t.FECHA DESC, t.ID DESC`,
      [empnit, fechaInicio, fechaFin]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar transacciones:', error.message);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

router.get('/paciente/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [pacienteRows] = await pool.query(
      'SELECT NOMBRE FROM pacientes WHERE CODPACIENTE = ? AND EMPNIT = ?',
      [req.params.codpaciente, empnit]
    );

    if (pacienteRows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const [rows] = await pool.query(
      `SELECT t.ID, t.EMPNIT, t.CODPACIENTE, t.FECHA, t.TIPO, t.MONTO, t.OBS
       FROM transacciones t
       WHERE t.EMPNIT = ? AND t.CODPACIENTE = ?
       ORDER BY t.FECHA ASC, t.ID ASC`,
      [empnit, req.params.codpaciente]
    );

    const nombrePaciente = pacienteRows[0].NOMBRE;

    let saldo = 0;
    const historial = rows.map((row) => {
      const monto = Number(row.MONTO) || 0;
      if (row.TIPO === 'ABONO') saldo += monto;
      else if (row.TIPO === 'PAGO') saldo -= monto;

      return { ...row, SALDO: saldo };
    });

    const totalAbonos = rows
      .filter((r) => r.TIPO === 'ABONO')
      .reduce((sum, r) => sum + (Number(r.MONTO) || 0), 0);

    const totalPagos = rows
      .filter((r) => r.TIPO === 'PAGO')
      .reduce((sum, r) => sum + (Number(r.MONTO) || 0), 0);

    res.json({
      paciente: nombrePaciente,
      codpaciente: Number(req.params.codpaciente),
      totalAbonos,
      totalPagos,
      saldo: totalAbonos - totalPagos,
      historial,
    });
  } catch (error) {
    console.error('Error al obtener estado de cuenta:', error.message);
    res.status(500).json({ error: 'Error al obtener estado de cuenta' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, FECHA, TIPO, MONTO, OBS } = req.body;

  if (!CODPACIENTE) {
    return res.status(400).json({ error: 'El paciente es requerido' });
  }

  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  if (!TIPO || !TIPOS_VALIDOS.includes(TIPO)) {
    return res.status(400).json({ error: 'El tipo debe ser PAGO o ABONO' });
  }

  if (MONTO === undefined || MONTO === null || MONTO === '') {
    return res.status(400).json({ error: 'El monto es requerido' });
  }

  if (Number(MONTO) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
  }

  try {
    const [paciente] = await pool.query(
      'SELECT CODPACIENTE FROM pacientes WHERE CODPACIENTE = ? AND EMPNIT = ?',
      [CODPACIENTE, empnit]
    );

    if (paciente.length === 0) {
      return res.status(400).json({ error: 'El paciente seleccionado no es válido' });
    }

    const [result] = await pool.query(
      `INSERT INTO transacciones (EMPNIT, CODPACIENTE, FECHA, TIPO, MONTO, OBS)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        empnit,
        CODPACIENTE,
        FECHA,
        TIPO,
        MONTO,
        OBS?.trim() || null,
      ]
    );

    const [pacienteInfo] = await pool.query(
      'SELECT NOMBRE FROM pacientes WHERE CODPACIENTE = ? AND EMPNIT = ?',
      [CODPACIENTE, empnit]
    );

    res.status(201).json({
      ID: result.insertId,
      EMPNIT: empnit,
      CODPACIENTE,
      FECHA,
      TIPO,
      MONTO,
      OBS: OBS?.trim() || null,
      PACIENTE: pacienteInfo[0]?.NOMBRE || null,
    });
  } catch (error) {
    console.error('Error al crear transacción:', error.message);
    res.status(500).json({ error: 'Error al registrar transacción' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, FECHA, TIPO, MONTO, OBS } = req.body;

  if (!CODPACIENTE) {
    return res.status(400).json({ error: 'El paciente es requerido' });
  }

  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  if (!TIPO || !TIPOS_VALIDOS.includes(TIPO)) {
    return res.status(400).json({ error: 'El tipo debe ser PAGO o ABONO' });
  }

  if (MONTO === undefined || MONTO === null || MONTO === '') {
    return res.status(400).json({ error: 'El monto es requerido' });
  }

  if (Number(MONTO) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE transacciones
       SET CODPACIENTE = ?, FECHA = ?, TIPO = ?, MONTO = ?, OBS = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [CODPACIENTE, FECHA, TIPO, MONTO, OBS?.trim() || null, req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    res.json({ message: 'Transacción actualizada' });
  } catch (error) {
    console.error('Error al actualizar transacción:', error.message);
    res.status(500).json({ error: 'Error al actualizar transacción' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM transacciones WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    res.json({ message: 'Transacción eliminada' });
  } catch (error) {
    console.error('Error al eliminar transacción:', error.message);
    res.status(500).json({ error: 'Error al eliminar transacción' });
  }
});

module.exports = router;
