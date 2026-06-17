const express = require('express');
const { pool } = require('../db/mysql');

const router = express.Router();

const MAX_LOGO_BYTES = 256 * 1024;
const MAX_LOGO_HEX_LENGTH = MAX_LOGO_BYTES * 2;

function isValidLogoHex(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const normalized = hex.trim();
  return normalized.length > 0
    && normalized.length % 2 === 0
    && normalized.length <= MAX_LOGO_HEX_LENGTH
    && /^[0-9a-fA-F]+$/.test(normalized);
}

function logoToHex(logo) {
  if (!logo) return null;
  if (Buffer.isBuffer(logo)) return logo.toString('hex');
  if (typeof logo === 'string') return logo.trim() || null;
  return null;
}

const EMPRESA_LIST_FIELDS = `
  EMPNIT,
  EMPRESA,
  CASE WHEN LOGO IS NOT NULL AND LENGTH(LOGO) > 0 THEN 1 ELSE 0 END AS TIENE_LOGO
`;

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${EMPRESA_LIST_FIELDS} FROM empresas ORDER BY EMPRESA`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar empresas:', error.message);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

router.get('/:empnit/logo', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT LOGO FROM empresas WHERE EMPNIT = ?',
      [req.params.empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const logoHex = logoToHex(rows[0].LOGO);
    res.json({ LOGO: logoHex });
  } catch (error) {
    console.error('Error al obtener logo:', error.message);
    res.status(500).json({ error: 'Error al obtener logo de la empresa' });
  }
});

router.get('/:empnit', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${EMPRESA_LIST_FIELDS} FROM empresas WHERE EMPNIT = ?`,
      [req.params.empnit]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener empresa:', error.message);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

router.post('/', async (req, res) => {
  const { EMPNIT, EMPRESA } = req.body;

  if (!EMPNIT?.trim()) {
    return res.status(400).json({ error: 'EMPNIT es requerido' });
  }

  try {
    await pool.query(
      'INSERT INTO empresas (EMPNIT, EMPRESA) VALUES (?, ?)',
      [EMPNIT.trim(), EMPRESA?.trim() || null]
    );
    res.status(201).json({ EMPNIT: EMPNIT.trim(), EMPRESA: EMPRESA?.trim() || null, TIENE_LOGO: 0 });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una empresa con ese EMPNIT' });
    }
    console.error('Error al crear empresa:', error.message);
    res.status(500).json({ error: 'Error al crear empresa' });
  }
});

router.put('/:empnit/logo', async (req, res) => {
  const { LOGO } = req.body;

  if (!isValidLogoHex(LOGO)) {
    return res.status(400).json({ error: 'LOGO inválido: debe ser una cadena hexadecimal de imagen' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE empresas SET LOGO = ? WHERE EMPNIT = ?',
      [LOGO.trim(), req.params.empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({ message: 'Logo actualizado', TIENE_LOGO: 1 });
  } catch (error) {
    console.error('Error al actualizar logo:', error.message);

    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(413).json({
        error: 'La imagen es demasiado grande. Use una imagen más pequeña o cambie LOGO a MEDIUMTEXT en la base de datos',
      });
    }

    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ error: 'La columna LOGO no existe en la tabla empresas' });
    }

    res.status(500).json({ error: 'Error al actualizar logo' });
  }
});

router.put('/:empnit', async (req, res) => {
  const { EMPRESA } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE empresas SET EMPRESA = ? WHERE EMPNIT = ?',
      [EMPRESA?.trim() || null, req.params.empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({ EMPNIT: req.params.empnit, EMPRESA: EMPRESA?.trim() || null });
  } catch (error) {
    console.error('Error al actualizar empresa:', error.message);
    res.status(500).json({ error: 'Error al actualizar empresa' });
  }
});

router.delete('/:empnit', async (req, res) => {
  try {
    const [empleados] = await pool.query(
      'SELECT COUNT(*) AS total FROM empleados WHERE EMPNIT = ?',
      [req.params.empnit]
    );

    if (empleados[0].total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar: la empresa tiene empleados asociados',
      });
    }

    const [result] = await pool.query(
      'DELETE FROM empresas WHERE EMPNIT = ?',
      [req.params.empnit]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    res.json({ message: 'Empresa eliminada' });
  } catch (error) {
    console.error('Error al eliminar empresa:', error.message);
    res.status(500).json({ error: 'Error al eliminar empresa' });
  }
});

module.exports = router;
