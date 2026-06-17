const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

function getEmpnit(req, res) {
  const empnit = req.query.empnit || req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

router.get('/stats', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const fechaInicio = req.query.fechaInicio || monthStart();
  const fechaFin = req.query.fechaFin || todayDate();

  if (fechaInicio > fechaFin) {
    return res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final' });
  }

  try {
    const [[ingresos]] = await pool.query(
      `SELECT COALESCE(SUM(MONTO), 0) AS total
       FROM transacciones
       WHERE EMPNIT = ? AND TIPO = 'ABONO' AND DATE(FECHA) >= ? AND DATE(FECHA) <= ?`,
      [empnit, fechaInicio, fechaFin]
    );

    const [[citas]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM agenda
       WHERE EMPNIT = ? AND DATE(FECHA) >= ? AND DATE(FECHA) <= ?`,
      [empnit, fechaInicio, fechaFin]
    );

    const [[gastos]] = await pool.query(
      `SELECT COALESCE(SUM(IMPORTE), 0) AS total
       FROM gastos
       WHERE EMPNIT = ? AND DATE(FECHA) >= ? AND DATE(FECHA) <= ?`,
      [empnit, fechaInicio, fechaFin]
    );

    const [citasPeriodo] = await pool.query(
      `SELECT a.ID, a.FECHA, a.FECHA_FIN, a.MOTIVO,
              e.EMPLEADO AS MEDICO, p.NOMBRE AS PACIENTE
       FROM agenda a
       LEFT JOIN empleados e ON e.CODEMP = a.CODEMP AND e.EMPNIT = a.EMPNIT
       LEFT JOIN pacientes p ON p.CODPACIENTE = a.CODPACIENTE AND p.EMPNIT = a.EMPNIT
       WHERE a.EMPNIT = ? AND DATE(a.FECHA) >= ? AND DATE(a.FECHA) <= ?
       ORDER BY a.FECHA ASC
       LIMIT 50`,
      [empnit, fechaInicio, fechaFin]
    );

    const [ingresosDetalle] = await pool.query(
      `SELECT t.ID, t.MONTO, t.FECHA, t.OBS,
              p.NOMBRE AS PACIENTE
       FROM transacciones t
       LEFT JOIN pacientes p ON p.CODPACIENTE = t.CODPACIENTE AND p.EMPNIT = t.EMPNIT
       WHERE t.EMPNIT = ? AND t.TIPO = 'ABONO' AND DATE(t.FECHA) >= ? AND DATE(t.FECHA) <= ?
       ORDER BY t.FECHA DESC, t.ID DESC
       LIMIT 50`,
      [empnit, fechaInicio, fechaFin]
    );

    const [gastosPorTipo] = await pool.query(
      `SELECT g.CODTIPO,
              COALESCE(gt.TIPO, 'Sin tipo') AS TIPO,
              COALESCE(SUM(g.IMPORTE), 0) AS total
       FROM gastos g
       LEFT JOIN gastos_tipos gt ON gt.CODTIPO = g.CODTIPO
       WHERE g.EMPNIT = ? AND DATE(g.FECHA) >= ? AND DATE(g.FECHA) <= ?
       GROUP BY g.CODTIPO, gt.TIPO
       ORDER BY total DESC`,
      [empnit, fechaInicio, fechaFin]
    );

    res.json({
      fechaInicio,
      fechaFin,
      empnit,
      ingresos_periodo: Number(ingresos.total) || 0,
      citas_periodo: Number(citas.total) || 0,
      gastos_periodo: Number(gastos.total) || 0,
      citas: citasPeriodo,
      ingresos: ingresosDetalle,
      gastos_por_tipo: gastosPorTipo.map((row) => ({
        CODTIPO: row.CODTIPO,
        TIPO: row.TIPO,
        total: Number(row.total) || 0,
      })),
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
  }
});

module.exports = router;
