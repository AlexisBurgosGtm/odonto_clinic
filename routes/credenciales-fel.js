const express = require('express');
const { pool } = require('../db/mysql');
const { DEFAULT_URLS, consultarNit, requireCredenciales } = require('../lib/fel-infile');

const router = express.Router();

const CRED_FIELDS = [
  'ID', 'EMPNIT', 'NIT_EMISOR', 'NOMBRE_EMISOR', 'NOMBRE_COMERCIAL', 'DIRECCION',
  'CODIGO_POSTAL', 'MUNICIPIO', 'DEPARTAMENTO', 'PAIS', 'CODIGO_ESTABLECIMIENTO',
  'CORREO_COPIA', 'USUARIO_FIRMA', 'LLAVE_FIRMA', 'USUARIO_API', 'LLAVE_API',
  'URL_FIRMA', 'URL_CERTIFICACION', 'URL_ANULACION', 'URL_PROCESO_UNIFICADO',
  'URL_CONSULTA_NIT', 'TIPO_CONTRIBUYENTE', 'TIPO_FRASE', 'CODIGO_ESCENARIO',
  'USAR_UNIFICADO',
];

function getEmpnit(req, res) {
  const empnit = req.headers['x-empnit'];
  if (!empnit) {
    res.status(401).json({ error: 'Sesión no válida: EMPNIT requerido' });
    return null;
  }
  return empnit;
}

function emptyCredenciales(empnit) {
  return {
    ID: null,
    EMPNIT: empnit,
    NIT_EMISOR: '',
    NOMBRE_EMISOR: '',
    NOMBRE_COMERCIAL: '',
    DIRECCION: '',
    CODIGO_POSTAL: '01001',
    MUNICIPIO: 'GUATEMALA',
    DEPARTAMENTO: 'GUATEMALA',
    PAIS: 'GT',
    CODIGO_ESTABLECIMIENTO: '1',
    CORREO_COPIA: '',
    USUARIO_FIRMA: '',
    LLAVE_FIRMA: '',
    USUARIO_API: '',
    LLAVE_API: '',
    ...DEFAULT_URLS,
    TIPO_CONTRIBUYENTE: 'GEN',
    TIPO_FRASE: 1,
    CODIGO_ESCENARIO: 1,
    USAR_UNIFICADO: 'SI',
  };
}

router.get('/emisor', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT NIT_EMISOR, NOMBRE_EMISOR, NOMBRE_COMERCIAL, DIRECCION, TIPO_CONTRIBUYENTE
       FROM credencialesFEL WHERE EMPNIT = ? LIMIT 1`,
      [empnit]
    );
    res.json(rows[0] || {
      NIT_EMISOR: '',
      NOMBRE_EMISOR: '',
      NOMBRE_COMERCIAL: '',
      DIRECCION: '',
      TIPO_CONTRIBUYENTE: 'GEN',
    });
  } catch (error) {
    console.error('Error al obtener emisor FEL:', error.message);
    res.status(500).json({ error: 'Error al obtener datos del emisor FEL' });
  }
});

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [rows] = await pool.query(
      `SELECT ${CRED_FIELDS.join(', ')} FROM credencialesFEL WHERE EMPNIT = ? LIMIT 1`,
      [empnit]
    );
    res.json(rows[0] || emptyCredenciales(empnit));
  } catch (error) {
    console.error('Error al obtener credenciales FEL:', error.message);
    res.status(500).json({ error: 'Error al obtener credenciales FEL' });
  }
});

router.put('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const {
    NIT_EMISOR, NOMBRE_EMISOR, NOMBRE_COMERCIAL, DIRECCION, CODIGO_POSTAL,
    MUNICIPIO, DEPARTAMENTO, PAIS, CODIGO_ESTABLECIMIENTO, CORREO_COPIA,
    USUARIO_FIRMA, LLAVE_FIRMA, USUARIO_API, LLAVE_API, URL_FIRMA,
    URL_CERTIFICACION, URL_ANULACION, URL_PROCESO_UNIFICADO, URL_CONSULTA_NIT,
    TIPO_CONTRIBUYENTE, TIPO_FRASE, CODIGO_ESCENARIO, USAR_UNIFICADO,
  } = req.body;

  if (!NIT_EMISOR?.trim()) {
    return res.status(400).json({ error: 'El NIT del emisor es requerido' });
  }
  if (!NOMBRE_EMISOR?.trim()) {
    return res.status(400).json({ error: 'El nombre del emisor es requerido' });
  }

  const tipo = String(TIPO_CONTRIBUYENTE || 'GEN').toUpperCase() === 'PEQ' ? 'PEQ' : 'GEN';
  const unificado = String(USAR_UNIFICADO || 'SI').toUpperCase() === 'NO' ? 'NO' : 'SI';
  const tipoFrase = Number(TIPO_FRASE) || (tipo === 'PEQ' ? 4 : 1);
  const codigoEscenario = Number(CODIGO_ESCENARIO) || 1;

  const values = [
    NIT_EMISOR.trim(),
    NOMBRE_EMISOR.trim(),
    NOMBRE_COMERCIAL?.trim() || null,
    DIRECCION?.trim() || null,
    CODIGO_POSTAL?.trim() || '01001',
    MUNICIPIO?.trim() || 'GUATEMALA',
    DEPARTAMENTO?.trim() || 'GUATEMALA',
    PAIS?.trim() || 'GT',
    CODIGO_ESTABLECIMIENTO?.trim() || '1',
    CORREO_COPIA?.trim() || null,
    USUARIO_FIRMA?.trim() || null,
    LLAVE_FIRMA?.trim() || null,
    USUARIO_API?.trim() || null,
    LLAVE_API?.trim() || null,
    URL_FIRMA?.trim() || DEFAULT_URLS.URL_FIRMA,
    URL_CERTIFICACION?.trim() || DEFAULT_URLS.URL_CERTIFICACION,
    URL_ANULACION?.trim() || DEFAULT_URLS.URL_ANULACION,
    URL_PROCESO_UNIFICADO?.trim() || DEFAULT_URLS.URL_PROCESO_UNIFICADO,
    URL_CONSULTA_NIT?.trim() || DEFAULT_URLS.URL_CONSULTA_NIT,
    tipo,
    tipoFrase,
    codigoEscenario,
    unificado,
  ];

  try {
    const [existing] = await pool.query(
      'SELECT ID FROM credencialesFEL WHERE EMPNIT = ? LIMIT 1',
      [empnit]
    );

    if (existing.length === 0) {
      const [result] = await pool.query(
        `INSERT INTO credencialesFEL (
          EMPNIT, NIT_EMISOR, NOMBRE_EMISOR, NOMBRE_COMERCIAL, DIRECCION, CODIGO_POSTAL,
          MUNICIPIO, DEPARTAMENTO, PAIS, CODIGO_ESTABLECIMIENTO, CORREO_COPIA,
          USUARIO_FIRMA, LLAVE_FIRMA, USUARIO_API, LLAVE_API, URL_FIRMA, URL_CERTIFICACION,
          URL_ANULACION, URL_PROCESO_UNIFICADO, URL_CONSULTA_NIT, TIPO_CONTRIBUYENTE,
          TIPO_FRASE, CODIGO_ESCENARIO, USAR_UNIFICADO
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empnit, ...values]
      );

      const [rows] = await pool.query(
        `SELECT ${CRED_FIELDS.join(', ')} FROM credencialesFEL WHERE ID = ?`,
        [result.insertId]
      );
      return res.json(rows[0]);
    }

    await pool.query(
      `UPDATE credencialesFEL SET
        NIT_EMISOR = ?, NOMBRE_EMISOR = ?, NOMBRE_COMERCIAL = ?, DIRECCION = ?,
        CODIGO_POSTAL = ?, MUNICIPIO = ?, DEPARTAMENTO = ?, PAIS = ?,
        CODIGO_ESTABLECIMIENTO = ?, CORREO_COPIA = ?, USUARIO_FIRMA = ?, LLAVE_FIRMA = ?,
        USUARIO_API = ?, LLAVE_API = ?, URL_FIRMA = ?, URL_CERTIFICACION = ?,
        URL_ANULACION = ?, URL_PROCESO_UNIFICADO = ?, URL_CONSULTA_NIT = ?,
        TIPO_CONTRIBUYENTE = ?, TIPO_FRASE = ?, CODIGO_ESCENARIO = ?, USAR_UNIFICADO = ?
       WHERE EMPNIT = ?`,
      [...values, empnit]
    );

    const [rows] = await pool.query(
      `SELECT ${CRED_FIELDS.join(', ')} FROM credencialesFEL WHERE EMPNIT = ? LIMIT 1`,
      [empnit]
    );
    res.json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un registro de credenciales FEL para esta empresa' });
    }
    console.error('Error al guardar credenciales FEL:', error.message);
    res.status(500).json({ error: 'Error al guardar credenciales FEL' });
  }
});

router.post('/consultar-nit', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const nit = req.body?.nit || req.body?.NIT;
  if (!nit?.trim()) {
    return res.status(400).json({ error: 'El NIT a consultar es requerido' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT ${CRED_FIELDS.join(', ')} FROM credencialesFEL WHERE EMPNIT = ? LIMIT 1`,
      [empnit]
    );
    const creds = rows[0];
    requireCredenciales(creds);
    const result = await consultarNit(creds, nit);
    res.json(result);
  } catch (error) {
    console.error('Error al consultar NIT FEL:', error.message);
    res.status(400).json({ error: error.message || 'No se pudo consultar el NIT' });
  }
});

module.exports = router;
