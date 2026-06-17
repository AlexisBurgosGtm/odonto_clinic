const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const TIPOS_VALIDOS = {
  ABONOS: 'ABONOS CLIENTES',
  GASTOS: 'GASTOS',
  TRATAMIENTOS: 'TRATAMIENTOS FINALIZADOS',
};

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

function parseMesAnio(req, res) {
  const mes = Number(req.query.mes);
  const anio = Number(req.query.anio);

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    res.status(400).json({ error: 'El mes debe estar entre 1 y 12' });
    return null;
  }

  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    res.status(400).json({ error: 'El año no es válido' });
    return null;
  }

  return { mes, anio };
}

function resolveTipo(tipo) {
  const normalized = String(tipo || '').trim().toUpperCase();

  if (normalized === 'ABONOS' || normalized === 'ABONOS CLIENTES') {
    return 'ABONOS';
  }

  if (normalized === 'GASTOS') {
    return 'GASTOS';
  }

  if (normalized === 'TRATAMIENTOS' || normalized === 'TRATAMIENTOS FINALIZADOS') {
    return 'TRATAMIENTOS';
  }

  return null;
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const periodo = parseMesAnio(req, res);
  if (!periodo) return;

  const tipoKey = resolveTipo(req.query.tipo);
  if (!tipoKey) {
    return res.status(400).json({
      error: 'Tipo de reporte no válido. Use: ABONOS CLIENTES, GASTOS o TRATAMIENTOS FINALIZADOS',
    });
  }

  const { mes, anio } = periodo;

  try {
    const [[empresaRow]] = await pool.query(
      'SELECT EMPRESA FROM empresas WHERE EMPNIT = ?',
      [empnit]
    );

    if (tipoKey === 'ABONOS') {
      const [rows] = await pool.query(
        `SELECT t.ID, t.FECHA, t.MONTO, t.OBS,
                p.NOMBRE AS PACIENTE
         FROM transacciones t
         LEFT JOIN pacientes p ON p.CODPACIENTE = t.CODPACIENTE AND p.EMPNIT = t.EMPNIT
         WHERE t.EMPNIT = ? AND t.TIPO = 'ABONO'
           AND YEAR(t.FECHA) = ? AND MONTH(t.FECHA) = ?
         ORDER BY t.FECHA ASC, t.ID ASC`,
        [empnit, anio, mes]
      );

      const total = rows.reduce((sum, row) => sum + (Number(row.MONTO) || 0), 0);

      return res.json({
        tipo: TIPOS_VALIDOS.ABONOS,
        mes,
        anio,
        empresa: empresaRow?.EMPRESA || '',
        total,
        filas: rows,
      });
    }

    if (tipoKey === 'GASTOS') {
      const [rows] = await pool.query(
        `SELECT g.ID, g.FECHA, g.DESCRIPCION, g.IMPORTE,
                gt.TIPO
         FROM gastos g
         LEFT JOIN gastos_tipos gt ON gt.CODTIPO = g.CODTIPO
         WHERE g.EMPNIT = ? AND YEAR(g.FECHA) = ? AND MONTH(g.FECHA) = ?
         ORDER BY g.FECHA ASC, g.ID ASC`,
        [empnit, anio, mes]
      );

      const total = rows.reduce((sum, row) => sum + (Number(row.IMPORTE) || 0), 0);

      return res.json({
        tipo: TIPOS_VALIDOS.GASTOS,
        mes,
        anio,
        empresa: empresaRow?.EMPRESA || '',
        total,
        filas: rows,
      });
    }

    const [rows] = await pool.query(
      `SELECT o.ID, o.FECHA_REALIZADO, o.DESPROD, o.PIEZA, o.PRECIO_FINAL, o.OBS,
              p.NOMBRE AS PACIENTE,
              e.EMPLEADO AS MEDICO
       FROM orders o
       LEFT JOIN pacientes p ON p.CODPACIENTE = o.CODPACIENTE AND p.EMPNIT = o.EMPNIT
       LEFT JOIN empleados e ON e.CODEMP = o.CODEMP AND e.EMPNIT = o.EMPNIT
       WHERE o.EMPNIT = ? AND o.REALIZADO = 'SI'
         AND YEAR(o.FECHA_REALIZADO) = ? AND MONTH(o.FECHA_REALIZADO) = ?
       ORDER BY o.FECHA_REALIZADO ASC, o.ID ASC`,
      [empnit, anio, mes]
    );

    const total = rows.reduce((sum, row) => sum + (Number(row.PRECIO_FINAL) || 0), 0);

    return res.json({
      tipo: TIPOS_VALIDOS.TRATAMIENTOS,
      mes,
      anio,
      empresa: empresaRow?.EMPRESA || '',
      total,
      filas: rows,
    });
  } catch (error) {
    console.error('Error al generar reporte:', error.message);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

module.exports = router;
