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

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeHora(value) {
  const raw = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [hh, mm] = raw.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseDetalle(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function normalizeDetalle(detalle) {
  const data = typeof detalle === 'string' ? parseDetalle(detalle) : detalle;
  if (!data || typeof data !== 'object') {
    throw new Error('Debe seleccionar los ítems de la receta');
  }

  const categoria = String(data.categoria || data.CATEGORIA || '').trim().toUpperCase();
  if (!categoria) {
    throw new Error('La categoría del tratamiento es requerida');
  }

  const medicamentos = Array.isArray(data.medicamentos) ? data.medicamentos : [];
  const indicaciones = Array.isArray(data.indicaciones) ? data.indicaciones : [];

  const normalizeItems = (items, tipo) => items.map((item) => ({
    id: item.id != null ? Number(item.id) : null,
    tipo,
    descripcion: String(item.descripcion || item.DESCRIPCION || '').trim(),
  })).filter((item) => item.descripcion);

  const meds = normalizeItems(medicamentos, 'MEDICAMENTO');
  const inds = normalizeItems(indicaciones, 'INDICACIONES');

  if (meds.length === 0 && inds.length === 0) {
    throw new Error('Debe agregar al menos un medicamento o una indicación');
  }

  return {
    categoria,
    medicamentos: meds,
    indicaciones: inds,
  };
}

function mapRow(row) {
  return {
    ...row,
    DETALLE: parseDetalle(row.DETALLE),
  };
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const fechaInicio = req.query.fechaInicio || todayDate();
  const fechaFin = req.query.fechaFin || todayDate();

  try {
    const [rows] = await pool.query(
      `SELECT r.ID, r.EMPNIT, r.CODPACIENTE, r.FECHA, r.HORA, r.DETALLE,
              p.NOMBRE AS PACIENTE
       FROM Recetas r
       LEFT JOIN pacientes p ON p.CODPACIENTE = r.CODPACIENTE AND p.EMPNIT = r.EMPNIT
       WHERE r.EMPNIT = ? AND r.FECHA >= ? AND r.FECHA <= ?
       ORDER BY r.FECHA DESC, r.HORA DESC, r.ID DESC`,
      [empnit, fechaInicio, fechaFin]
    );
    res.json(rows.map(mapRow));
  } catch (error) {
    console.error('Error al listar recetas:', error.message);
    res.status(500).json({ error: 'Error al obtener recetas' });
  }
});

router.get('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT r.ID, r.EMPNIT, r.CODPACIENTE, r.FECHA, r.HORA, r.DETALLE,
              p.NOMBRE AS PACIENTE
       FROM Recetas r
       LEFT JOIN pacientes p ON p.CODPACIENTE = r.CODPACIENTE AND p.EMPNIT = r.EMPNIT
       WHERE r.ID = ? AND r.EMPNIT = ?`,
      [req.params.id, empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    res.json(mapRow(rows[0]));
  } catch (error) {
    console.error('Error al obtener receta:', error.message);
    res.status(500).json({ error: 'Error al obtener receta' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, FECHA, HORA, DETALLE } = req.body;

  if (!CODPACIENTE) {
    return res.status(400).json({ error: 'El paciente es requerido' });
  }
  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  const hora = normalizeHora(HORA);
  if (!hora) {
    return res.status(400).json({ error: 'La hora debe tener formato HH:MM' });
  }

  let detalle;
  try {
    detalle = normalizeDetalle(DETALLE);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const [paciente] = await pool.query(
      'SELECT CODPACIENTE, NOMBRE FROM pacientes WHERE CODPACIENTE = ? AND EMPNIT = ?',
      [CODPACIENTE, empnit]
    );

    if (paciente.length === 0) {
      return res.status(400).json({ error: 'El paciente seleccionado no es válido' });
    }

    const [result] = await pool.query(
      `INSERT INTO Recetas (EMPNIT, CODPACIENTE, FECHA, HORA, DETALLE)
       VALUES (?, ?, ?, ?, ?)`,
      [empnit, CODPACIENTE, FECHA, hora, JSON.stringify(detalle)]
    );

    res.status(201).json({
      ID: result.insertId,
      EMPNIT: empnit,
      CODPACIENTE: Number(CODPACIENTE),
      FECHA,
      HORA: hora,
      DETALLE: detalle,
      PACIENTE: paciente[0].NOMBRE || null,
    });
  } catch (error) {
    console.error('Error al crear receta:', error.message);
    res.status(500).json({ error: 'Error al crear receta' });
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { CODPACIENTE, FECHA, HORA, DETALLE } = req.body;

  if (!CODPACIENTE) {
    return res.status(400).json({ error: 'El paciente es requerido' });
  }
  if (!FECHA) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  const hora = normalizeHora(HORA);
  if (!hora) {
    return res.status(400).json({ error: 'La hora debe tener formato HH:MM' });
  }

  let detalle;
  try {
    detalle = normalizeDetalle(DETALLE);
  } catch (error) {
    return res.status(400).json({ error: error.message });
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
      `UPDATE Recetas
       SET CODPACIENTE = ?, FECHA = ?, HORA = ?, DETALLE = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [CODPACIENTE, FECHA, hora, JSON.stringify(detalle), req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    const [rows] = await pool.query(
      `SELECT r.ID, r.EMPNIT, r.CODPACIENTE, r.FECHA, r.HORA, r.DETALLE,
              p.NOMBRE AS PACIENTE
       FROM Recetas r
       LEFT JOIN pacientes p ON p.CODPACIENTE = r.CODPACIENTE AND p.EMPNIT = r.EMPNIT
       WHERE r.ID = ? AND r.EMPNIT = ?`,
      [req.params.id, empnit]
    );

    res.json(mapRow(rows[0]));
  } catch (error) {
    console.error('Error al actualizar receta:', error.message);
    res.status(500).json({ error: 'Error al actualizar receta' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [result] = await pool.query(
      'DELETE FROM Recetas WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Receta no encontrada' });
    }

    res.json({ message: 'Receta eliminada' });
  } catch (error) {
    console.error('Error al eliminar receta:', error.message);
    res.status(500).json({ error: 'Error al eliminar receta' });
  }
});

module.exports = router;
