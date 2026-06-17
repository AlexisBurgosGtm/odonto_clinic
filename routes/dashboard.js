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

router.get('/stats', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const fecha = req.query.fecha;
  if (!fecha) {
    return res.status(400).json({ error: 'La fecha es requerida' });
  }

  try {
    const [[ingresos]] = await pool.query(
      `SELECT COALESCE(SUM(MONTO), 0) AS total
       FROM transacciones
       WHERE EMPNIT = ? AND TIPO = 'ABONO' AND DATE(FECHA) = ?`,
      [empnit, fecha]
    );

    const [[citas]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM agenda
       WHERE EMPNIT = ? AND DATE(FECHA) = ?`,
      [empnit, fecha]
    );

    const [[pacientes]] = await pool.query(
      'SELECT COUNT(*) AS total FROM pacientes WHERE EMPNIT = ?',
      [empnit]
    );

    const [[pendientes]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM orders
       WHERE EMPNIT = ? AND REALIZADO = 'NO'`,
      [empnit]
    );

    const [[empleados]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM empleados
       WHERE EMPNIT = ? AND HABILITADO = 'SI'`,
      [empnit]
    );

    const [citasDia] = await pool.query(
      `SELECT a.ID, a.FECHA, a.FECHA_FIN, a.MOTIVO,
              e.EMPLEADO AS MEDICO, p.NOMBRE AS PACIENTE
       FROM agenda a
       LEFT JOIN empleados e ON e.CODEMP = a.CODEMP AND e.EMPNIT = a.EMPNIT
       LEFT JOIN pacientes p ON p.CODPACIENTE = a.CODPACIENTE AND p.EMPNIT = a.EMPNIT
       WHERE a.EMPNIT = ? AND DATE(a.FECHA) = ?
       ORDER BY a.FECHA ASC
       LIMIT 20`,
      [empnit, fecha]
    );

    const [ingresosDetalle] = await pool.query(
      `SELECT t.ID, t.MONTO, t.FECHA, t.OBS,
              p.NOMBRE AS PACIENTE
       FROM transacciones t
       LEFT JOIN pacientes p ON p.CODPACIENTE = t.CODPACIENTE AND p.EMPNIT = t.EMPNIT
       WHERE t.EMPNIT = ? AND t.TIPO = 'ABONO' AND DATE(t.FECHA) = ?
       ORDER BY t.FECHA DESC, t.ID DESC
       LIMIT 15`,
      [empnit, fecha]
    );

    res.json({
      fecha,
      empnit,
      ingresos_dia: Number(ingresos.total) || 0,
      citas_hoy: Number(citas.total) || 0,
      pacientes: Number(pacientes.total) || 0,
      tratamientos_pendientes: Number(pendientes.total) || 0,
      empleados_activos: Number(empleados.total) || 0,
      citas: citasDia,
      ingresos: ingresosDetalle,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
  }
});

module.exports = router;
