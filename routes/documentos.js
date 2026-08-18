const express = require('express');
const { pool } = require('../db/mysql');
const {
  nitSinGuion,
  round2,
  tipoDteFromCredenciales,
  buildDteXml,
  buildAnulacionXml,
  certificarDte,
  anularDte,
  requireCredenciales,
  toMysqlDatetime,
} = require('../lib/fel-infile');

const router = express.Router();

const DOC_FIELDS = `
  d.ID, d.EMPNIT, d.NUMERO, d.FECHA, d.NIT, d.NOMBRE, d.DIRECCION, d.EMAIL,
  d.CODPACIENTE, d.CONCRE, d.TIPO_DTE, d.IMPORTE, d.SERIE_FEL, d.NUMERO_FEL,
  d.FECHA_FEL, d.UUID, d.ESTADO, d.IDENTIFICADOR, d.MENSAJE, d.OBS
`;

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

function normalizeConcre(value) {
  return String(value || 'CONTADO').toUpperCase() === 'CREDITO' ? 'CREDITO' : 'CONTADO';
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Debe agregar al menos un tratamiento a facturar');
  }

  return items.map((item, index) => {
    const CODPROD = String(item.CODPROD || '').trim();
    const DESPROD = String(item.DESPROD || '').trim();
    const CANTIDAD = Number(item.CANTIDAD);
    const COSTO = Number(item.COSTO);
    const PRECIO = Number(item.PRECIO);

    if (!CODPROD) throw new Error(`El código del ítem ${index + 1} es requerido`);
    if (!DESPROD) throw new Error(`La descripción del ítem ${index + 1} es requerida`);
    if (!CANTIDAD || CANTIDAD <= 0) throw new Error(`La cantidad del ítem ${index + 1} debe ser mayor a cero`);
    if (Number.isNaN(PRECIO) || PRECIO < 0) throw new Error(`El precio del ítem ${index + 1} es inválido`);

    const total = round2(CANTIDAD * PRECIO);
    return {
      CODPROD,
      DESPROD,
      CANTIDAD: round2(CANTIDAD),
      COSTO: Number.isNaN(COSTO) ? 0 : round2(COSTO),
      PRECIO: round2(PRECIO),
      TOTAL: total,
      ORDER_ID: item.ORDER_ID ? Number(item.ORDER_ID) : null,
    };
  });
}

async function getCredenciales(empnit) {
  const [rows] = await pool.query(
    'SELECT * FROM credencialesFEL WHERE EMPNIT = ? LIMIT 1',
    [empnit]
  );
  return rows[0] || null;
}

async function getDocumento(empnit, id) {
  const [rows] = await pool.query(
    `SELECT ${DOC_FIELDS}, p.NOMBRE AS PACIENTE
     FROM DOCUMENTOS d
     LEFT JOIN pacientes p ON p.CODPACIENTE = d.CODPACIENTE AND p.EMPNIT = d.EMPNIT
     WHERE d.ID = ? AND d.EMPNIT = ?`,
    [id, empnit]
  );
  if (rows.length === 0) return null;

  const [items] = await pool.query(
    `SELECT ID, EMPNIT, CODDOC, CODPROD, DESPROD, CANTIDAD, COSTO, PRECIO, TOTAL, ORDER_ID
     FROM DOCPRODUCTOS
     WHERE EMPNIT = ? AND CODDOC = ?
     ORDER BY ID`,
    [empnit, id]
  );

  return { ...rows[0], items };
}

async function nextNumero(connection, empnit) {
  const [rows] = await connection.query(
    'SELECT COALESCE(MAX(NUMERO), 0) + 1 AS SIGUIENTE FROM DOCUMENTOS WHERE EMPNIT = ? FOR UPDATE',
    [empnit]
  );
  return Number(rows[0]?.SIGUIENTE) || 1;
}

async function insertItems(connection, empnit, coddoc, items) {
  for (const item of items) {
    await connection.query(
      `INSERT INTO DOCPRODUCTOS
        (EMPNIT, CODDOC, CODPROD, DESPROD, CANTIDAD, COSTO, PRECIO, TOTAL, ORDER_ID)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empnit, coddoc, item.CODPROD, item.DESPROD, item.CANTIDAD, item.COSTO, item.PRECIO, item.TOTAL, item.ORDER_ID]
    );
  }
}

async function aplicarCertificacion(empnit, documento, items, creds) {
  requireCredenciales(creds);
  const identificador = documento.IDENTIFICADOR || `DOC-${empnit}-${documento.ID}`;
  const xml = buildDteXml({ documento, items, creds });
  const result = await certificarDte(creds, xml, identificador);

  if (!result.resultado || !result.uuid) {
    await pool.query(
      `UPDATE DOCUMENTOS
       SET ESTADO = 'ERROR', MENSAJE = ?, IDENTIFICADOR = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [String(result.descripcion || 'Error al certificar').slice(0, 1000), identificador, documento.ID, empnit]
    );
    const error = new Error(result.descripcion || 'INFILE rechazó la certificación');
    error.status = 400;
    throw error;
  }

  await pool.query(
    `UPDATE DOCUMENTOS SET
      ESTADO = 'CERTIFICADO',
      UUID = ?,
      SERIE_FEL = ?,
      NUMERO_FEL = ?,
      FECHA_FEL = ?,
      XML_CERTIFICADO = ?,
      IDENTIFICADOR = ?,
      MENSAJE = NULL
     WHERE ID = ? AND EMPNIT = ?`,
    [
      result.uuid,
      result.serie,
      result.numero,
      result.fecha ? toMysqlDatetime(result.fecha) : toMysqlDatetime(new Date()),
      result.xml,
      identificador,
      documento.ID,
      empnit,
    ]
  );

  return getDocumento(empnit, documento.ID);
}

router.get('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const fechaInicio = req.query.fechaInicio || todayDate();
  const fechaFin = req.query.fechaFin || todayDate();
  const estado = String(req.query.estado || '').toUpperCase();

  try {
    const params = [empnit, fechaInicio, fechaFin];
    let extra = '';
    if (['PENDIENTE', 'CERTIFICADO', 'ANULADO', 'ERROR'].includes(estado)) {
      extra = ' AND d.ESTADO = ?';
      params.push(estado);
    }

    const [rows] = await pool.query(
      `SELECT ${DOC_FIELDS}, p.NOMBRE AS PACIENTE
       FROM DOCUMENTOS d
       LEFT JOIN pacientes p ON p.CODPACIENTE = d.CODPACIENTE AND p.EMPNIT = d.EMPNIT
       WHERE d.EMPNIT = ? AND d.FECHA >= ? AND d.FECHA <= ?${extra}
       ORDER BY d.FECHA DESC, d.NUMERO DESC`,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al listar documentos:', error.message);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

router.get('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const doc = await getDocumento(empnit, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(doc);
  } catch (error) {
    console.error('Error al obtener documento:', error.message);
    res.status(500).json({ error: 'Error al obtener documento' });
  }
});

router.post('/', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { FECHA, NIT, NOMBRE, DIRECCION, EMAIL, CODPACIENTE, CONCRE, OBS, items, certificar } = req.body;

  if (!FECHA) return res.status(400).json({ error: 'La fecha es requerida' });
  if (!NOMBRE?.trim()) return res.status(400).json({ error: 'El nombre del cliente es requerido' });

  let normalizedItems;
  try {
    normalizedItems = normalizeItems(items);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const importe = round2(normalizedItems.reduce((sum, item) => sum + item.TOTAL, 0));
  const nit = nitSinGuion(NIT || 'CF');
  const concre = normalizeConcre(CONCRE);

  const connection = await pool.getConnection();
  try {
    const creds = await getCredenciales(empnit);
    const tipoDte = tipoDteFromCredenciales(creds);

    await connection.beginTransaction();
    const numero = await nextNumero(connection, empnit);
    const [result] = await connection.query(
      `INSERT INTO DOCUMENTOS (
        EMPNIT, NUMERO, FECHA, NIT, NOMBRE, DIRECCION, EMAIL, CODPACIENTE,
        CONCRE, TIPO_DTE, IMPORTE, ESTADO, OBS
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)`,
      [
        empnit,
        numero,
        FECHA,
        nit,
        NOMBRE.trim(),
        DIRECCION?.trim() || null,
        EMAIL?.trim() || null,
        CODPACIENTE || null,
        concre,
        tipoDte,
        importe,
        OBS?.trim() || null,
      ]
    );

    const id = result.insertId;
    const identificador = `DOC-${String(empnit).replace(/[^A-Za-z0-9]/g, '')}-${id}`;
    await connection.query(
      'UPDATE DOCUMENTOS SET IDENTIFICADOR = ? WHERE ID = ? AND EMPNIT = ?',
      [identificador, id, empnit]
    );
    await insertItems(connection, empnit, id, normalizedItems);
    await connection.commit();

    if (certificar) {
      const documento = {
        ID: id,
        FECHA,
        NIT: nit,
        NOMBRE: NOMBRE.trim(),
        DIRECCION: DIRECCION?.trim() || null,
        EMAIL: EMAIL?.trim() || null,
        TIPO_DTE: tipoDte,
        IDENTIFICADOR: identificador,
      };
      const certified = await aplicarCertificacion(empnit, documento, normalizedItems, creds);
      return res.status(201).json(certified);
    }

    const created = await getDocumento(empnit, id);
    res.status(201).json(created);
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* ignore */ }
    console.error('Error al crear documento:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Error al crear documento' });
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const { FECHA, NIT, NOMBRE, DIRECCION, EMAIL, CODPACIENTE, CONCRE, OBS, items } = req.body;

  if (!FECHA) return res.status(400).json({ error: 'La fecha es requerida' });
  if (!NOMBRE?.trim()) return res.status(400).json({ error: 'El nombre del cliente es requerido' });

  let normalizedItems;
  try {
    normalizedItems = normalizeItems(items);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const importe = round2(normalizedItems.reduce((sum, item) => sum + item.TOTAL, 0));
  const nit = nitSinGuion(NIT || 'CF');
  const concre = normalizeConcre(CONCRE);

  const connection = await pool.getConnection();
  try {
    const [existente] = await connection.query(
      'SELECT ID, ESTADO FROM DOCUMENTOS WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );
    if (existente.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    if (!['PENDIENTE', 'ERROR'].includes(existente[0].ESTADO)) {
      return res.status(400).json({ error: 'Solo se pueden editar documentos pendientes o con error' });
    }

    const creds = await getCredenciales(empnit);
    const tipoDte = tipoDteFromCredenciales(creds);

    await connection.beginTransaction();
    await connection.query(
      `UPDATE DOCUMENTOS SET
        FECHA = ?, NIT = ?, NOMBRE = ?, DIRECCION = ?, EMAIL = ?, CODPACIENTE = ?,
        CONCRE = ?, TIPO_DTE = ?, IMPORTE = ?, ESTADO = 'PENDIENTE', MENSAJE = NULL, OBS = ?
       WHERE ID = ? AND EMPNIT = ?`,
      [
        FECHA,
        nit,
        NOMBRE.trim(),
        DIRECCION?.trim() || null,
        EMAIL?.trim() || null,
        CODPACIENTE || null,
        concre,
        tipoDte,
        importe,
        OBS?.trim() || null,
        req.params.id,
        empnit,
      ]
    );
    await connection.query(
      'DELETE FROM DOCPRODUCTOS WHERE EMPNIT = ? AND CODDOC = ?',
      [empnit, req.params.id]
    );
    await insertItems(connection, empnit, req.params.id, normalizedItems);
    await connection.commit();

    res.json(await getDocumento(empnit, req.params.id));
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* ignore */ }
    console.error('Error al actualizar documento:', error.message);
    res.status(500).json({ error: 'Error al actualizar documento' });
  } finally {
    connection.release();
  }
});

router.post('/:id/certificar', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const documento = await getDocumento(empnit, req.params.id);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });
    if (documento.ESTADO === 'CERTIFICADO') {
      return res.json(documento);
    }
    if (documento.ESTADO === 'ANULADO') {
      return res.status(400).json({ error: 'No se puede certificar un documento anulado' });
    }

    const creds = await getCredenciales(empnit);
    const certified = await aplicarCertificacion(empnit, documento, documento.items, creds);
    res.json(certified);
  } catch (error) {
    console.error('Error al certificar documento:', error.message);
    res.status(error.status || 500).json({ error: error.message || 'Error al certificar documento' });
  }
});

router.post('/:id/anular', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  const motivo = String(req.body?.motivo || req.body?.MOTIVO || '').trim();
  if (!motivo) {
    return res.status(400).json({ error: 'El motivo de anulación es requerido' });
  }

  try {
    const documento = await getDocumento(empnit, req.params.id);
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' });
    if (documento.ESTADO !== 'CERTIFICADO' || !documento.UUID) {
      return res.status(400).json({ error: 'Solo se pueden anular documentos certificados' });
    }

    const creds = await getCredenciales(empnit);
    requireCredenciales(creds);
    const xml = buildAnulacionXml({ documento, creds, motivo });
    const result = await anularDte(creds, xml, documento.IDENTIFICADOR || `DOC-${empnit}-${documento.ID}`);

    if (!result.resultado) {
      return res.status(400).json({ error: result.descripcion || 'INFILE rechazó la anulación' });
    }

    await pool.query(
      `UPDATE DOCUMENTOS SET ESTADO = 'ANULADO', MENSAJE = ? WHERE ID = ? AND EMPNIT = ?`,
      [motivo.slice(0, 1000), documento.ID, empnit]
    );

    res.json(await getDocumento(empnit, documento.ID));
  } catch (error) {
    console.error('Error al anular documento:', error.message);
    res.status(400).json({ error: error.message || 'Error al anular documento' });
  }
});

router.delete('/:id', async (req, res) => {
  const empnit = getEmpnit(req, res);
  if (!empnit) return;

  try {
    const [existente] = await pool.query(
      'SELECT ID, ESTADO FROM DOCUMENTOS WHERE ID = ? AND EMPNIT = ?',
      [req.params.id, empnit]
    );
    if (existente.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    if (!['PENDIENTE', 'ERROR'].includes(existente[0].ESTADO)) {
      return res.status(400).json({ error: 'Solo se pueden eliminar documentos pendientes o con error' });
    }

    await pool.query('DELETE FROM DOCPRODUCTOS WHERE EMPNIT = ? AND CODDOC = ?', [empnit, req.params.id]);
    await pool.query('DELETE FROM DOCUMENTOS WHERE ID = ? AND EMPNIT = ?', [req.params.id, empnit]);
    res.json({ message: 'Documento eliminado' });
  } catch (error) {
    console.error('Error al eliminar documento:', error.message);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

module.exports = router;
