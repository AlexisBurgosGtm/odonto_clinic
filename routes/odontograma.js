const express = require('express');
const { pool } = require('../db/mysql');
const {
  ESTADOS_ODONTOGRAMA,
  getLayout,
  getPiezasSet,
  normalizeTipoPaciente,
  normalizePiezaFdi,
  isEstadoValido,
} = require('../lib/odontograma-piezas');

const router = express.Router();

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

router.get('/estados', (_req, res) => {
  res.json(ESTADOS_ODONTOGRAMA);
});

router.get('/paciente/:codpaciente', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [pacientes] = await pool.query(
      `SELECT CODPACIENTE, NOMBRE, NACIMIENTO, TIPO_PACIENTE
       FROM pacientes
       WHERE CODPACIENTE = ? AND EMPNIT = ?`,
      [req.params.codpaciente, empnit]
    );

    if (pacientes.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const paciente = pacientes[0];
    const tipoPaciente = normalizeTipoPaciente(paciente.TIPO_PACIENTE);
    const layout = getLayout(tipoPaciente);
    const piezasValidas = getPiezasSet(tipoPaciente);

    const [estados] = await pool.query(
      `SELECT ID, PIEZA, ESTADO, NOTA, FECHA_ACT
       FROM odontograma
       WHERE EMPNIT = ? AND CODPACIENTE = ?`,
      [empnit, req.params.codpaciente]
    );

    const [tratamientos] = await pool.query(
      `SELECT ID, PIEZA, CODPROD, DESPROD, PRECIO, PRECIO_FINAL, REALIZADO, FECHA, OBS
       FROM orders
       WHERE EMPNIT = ? AND CODPACIENTE = ?
       ORDER BY FECHA DESC, ID DESC`,
      [empnit, req.params.codpaciente]
    );

    const estadoByPieza = {};
    estados.forEach((row) => {
      const key = normalizePiezaFdi(row.PIEZA);
      if (key) estadoByPieza[key] = row;
    });

    const tratamientosByPieza = {};
    tratamientos.forEach((row) => {
      const key = normalizePiezaFdi(row.PIEZA);
      if (!key) return;
      if (!tratamientosByPieza[key]) tratamientosByPieza[key] = [];
      tratamientosByPieza[key].push(row);
    });

    const chart = piezasValidas.map((pieza) => {
      const key = normalizePiezaFdi(pieza);
      const estadoRow = estadoByPieza[key];
      const trat = tratamientosByPieza[key] || [];
      return {
        PIEZA: pieza,
        ESTADO: estadoRow?.ESTADO || 'SANO',
        NOTA: estadoRow?.NOTA || null,
        FECHA_ACT: estadoRow?.FECHA_ACT || null,
        tratamientos: trat,
        pendientes: trat.filter((t) => t.REALIZADO !== 'SI').length,
        finalizados: trat.filter((t) => t.REALIZADO === 'SI').length,
      };
    });

    res.json({
      paciente: {
        CODPACIENTE: paciente.CODPACIENTE,
        NOMBRE: paciente.NOMBRE,
        NACIMIENTO: paciente.NACIMIENTO,
        TIPO_PACIENTE: tipoPaciente,
      },
      layout,
      nomenclatura: 'FDI',
      estadosCatalogo: ESTADOS_ODONTOGRAMA,
      chart,
    });
  } catch (error) {
    console.error('Error al obtener odontograma:', error.message);
    res.status(500).json({ error: 'Error al obtener odontograma' });
  }
});

router.put('/paciente/:codpaciente/pieza/:pieza', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const pieza = normalizePiezaFdi(req.params.pieza);
  const ESTADO = String(req.body?.ESTADO || '').trim().toUpperCase();
  const NOTA = req.body?.NOTA != null ? String(req.body.NOTA).trim() : null;

  if (!pieza) {
    return res.status(400).json({ error: 'La pieza es requerida' });
  }
  if (!isEstadoValido(ESTADO)) {
    return res.status(400).json({ error: 'Estado de pieza no válido' });
  }

  try {
    const [pacientes] = await pool.query(
      'SELECT CODPACIENTE, TIPO_PACIENTE FROM pacientes WHERE CODPACIENTE = ? AND EMPNIT = ?',
      [req.params.codpaciente, empnit]
    );
    if (pacientes.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const tipoPaciente = normalizeTipoPaciente(pacientes[0].TIPO_PACIENTE);
    const validas = getPiezasSet(tipoPaciente).map((p) => normalizePiezaFdi(p));
    if (!validas.includes(pieza)) {
      return res.status(400).json({ error: 'La pieza no corresponde al tipo de dentición del paciente' });
    }

    const [existing] = await pool.query(
      `SELECT ID FROM odontograma
       WHERE EMPNIT = ? AND CODPACIENTE = ? AND PIEZA = ?`,
      [empnit, req.params.codpaciente, pieza]
    );

    if (existing.length === 0) {
      const [result] = await pool.query(
        `INSERT INTO odontograma (EMPNIT, CODPACIENTE, PIEZA, ESTADO, NOTA, FECHA_ACT)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [empnit, req.params.codpaciente, pieza, ESTADO, NOTA || null]
      );
      return res.json({
        ID: result.insertId,
        EMPNIT: empnit,
        CODPACIENTE: Number(req.params.codpaciente),
        PIEZA: pieza,
        ESTADO,
        NOTA: NOTA || null,
      });
    }

    await pool.query(
      `UPDATE odontograma
       SET ESTADO = ?, NOTA = ?, FECHA_ACT = NOW()
       WHERE ID = ?`,
      [ESTADO, NOTA || null, existing[0].ID]
    );

    res.json({
      ID: existing[0].ID,
      EMPNIT: empnit,
      CODPACIENTE: Number(req.params.codpaciente),
      PIEZA: pieza,
      ESTADO,
      NOTA: NOTA || null,
    });
  } catch (error) {
    console.error('Error al actualizar pieza odontograma:', error.message);
    res.status(500).json({ error: 'Error al actualizar estado de la pieza' });
  }
});

module.exports = router;
