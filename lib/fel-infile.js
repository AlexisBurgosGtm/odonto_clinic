const DEFAULT_URLS = {
  URL_FIRMA: 'https://signer-emisores.feel.com.gt/sign_solicitud_firmas/firma_xml',
  URL_CERTIFICACION: 'https://certificador.feel.com.gt/fel/certificacion/v2/dte/',
  URL_ANULACION: 'https://certificador.feel.com.gt/fel/anulacion/v2/dte/',
  URL_PROCESO_UNIFICADO: 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml',
  URL_CONSULTA_NIT: 'https://consultareceptores.feel.com.gt/rest/action',
};

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function nitSinGuion(nit) {
  const raw = String(nit ?? '').trim().toUpperCase().replace(/[-\s]/g, '');
  return raw || 'CF';
}

function fechaHoraGt(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}-06:00`;
}

function fechaHoraFromDateString(fecha, time = '12:00:00') {
  const day = String(fecha || '').split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fechaHoraGt();
  return `${day}T${time}-06:00`;
}

function toMysqlDatetime(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  const s = String(value).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (iso) return `${iso[1]} ${iso[2]}`;

  const gt = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
  if (gt) {
    const time = gt[4] && gt[4].length === 5 ? `${gt[4]}:00` : (gt[4] || '00:00:00');
    return `${gt[3]}-${gt[2]}-${gt[1]} ${time}`;
  }

  return s.slice(0, 19).replace('T', ' ');
}

function money(value) {
  return round2(value).toFixed(2);
}

function tipoDteFromCredenciales(creds) {
  return String(creds?.TIPO_CONTRIBUYENTE || 'GEN').toUpperCase() === 'PEQ' ? 'FPEQ' : 'FACT';
}

function afiliacionIva(creds) {
  return String(creds?.TIPO_CONTRIBUYENTE || 'GEN').toUpperCase() === 'PEQ' ? 'PEQ' : 'GEN';
}

function calcItemIva(precio, cantidad) {
  const total = round2(Number(precio) * Number(cantidad || 1));
  const gravable = round2(total / 1.12);
  const impuesto = round2(total - gravable);
  return { total, gravable, impuesto };
}

function buildDteXml({ documento, items, creds }) {
  const tipo = documento.TIPO_DTE === 'FPEQ' ? 'FPEQ' : 'FACT';
  const esPeq = tipo === 'FPEQ';
  const fechaEmision = fechaHoraFromDateString(documento.FECHA);
  const nitEmisor = nitSinGuion(creds.NIT_EMISOR);
  const nitReceptor = nitSinGuion(documento.NIT);
  const nombreReceptor = xmlEscape(documento.NOMBRE || (nitReceptor === 'CF' ? 'CONSUMIDOR FINAL' : ''));
  const direccionReceptor = xmlEscape(documento.DIRECCION || 'CIUDAD');
  const correoReceptor = documento.EMAIL ? `\n          CorreoReceptor="${xmlEscape(documento.EMAIL)}"` : '';
  const tipoFrase = Number(creds.TIPO_FRASE) || (esPeq ? 4 : 1);
  const codigoEscenario = Number(creds.CODIGO_ESCENARIO) || 1;

  const lineas = items.map((item, index) => {
    const cantidad = Number(item.CANTIDAD) || 1;
    const precioUnitario = round2(item.PRECIO);
    const { total, gravable, impuesto } = calcItemIva(precioUnitario, cantidad);
    const precio = round2(precioUnitario * cantidad);
    const impuestos = esPeq ? '' : `
            <dte:Impuestos>
              <dte:Impuesto>
                <dte:NombreCorto>IVA</dte:NombreCorto>
                <dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable>
                <dte:MontoGravable>${money(gravable)}</dte:MontoGravable>
                <dte:MontoImpuesto>${money(impuesto)}</dte:MontoImpuesto>
              </dte:Impuesto>
            </dte:Impuestos>`;

    return `
          <dte:Item BienOServicio="S" NumeroLinea="${index + 1}">
            <dte:Cantidad>${money(cantidad)}</dte:Cantidad>
            <dte:UnidadMedida>UND</dte:UnidadMedida>
            <dte:Descripcion>${xmlEscape(item.DESPROD || item.CODPROD)}</dte:Descripcion>
            <dte:PrecioUnitario>${money(precioUnitario)}</dte:PrecioUnitario>
            <dte:Precio>${money(precio)}</dte:Precio>
            <dte:Descuento>0.00</dte:Descuento>${impuestos}
            <dte:Total>${money(total)}</dte:Total>
          </dte:Item>`;
  }).join('');

  const granTotal = round2(items.reduce((sum, item) => sum + (Number(item.TOTAL) || 0), 0));
  const totalIva = esPeq
    ? 0
    : round2(items.reduce((sum, item) => sum + calcItemIva(item.PRECIO, item.CANTIDAD).impuesto, 0));

  const totalesImpuestos = esPeq ? '' : `
          <dte:TotalImpuestos>
            <dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${money(totalIva)}"/>
          </dte:TotalImpuestos>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1">
  <dte:SAT ClaseDocumento="dte">
    <dte:DTE ID="DatosCertificados">
      <dte:DatosEmision ID="DatosEmision">
        <dte:DatosGenerales Tipo="${tipo}" FechaHoraEmision="${fechaEmision}" CodigoMoneda="GTQ"/>
        <dte:Emisor NITEmisor="${xmlEscape(nitEmisor)}" NombreEmisor="${xmlEscape(creds.NOMBRE_EMISOR)}" CodigoEstablecimiento="${xmlEscape(creds.CODIGO_ESTABLECIMIENTO || '1')}" NombreComercial="${xmlEscape(creds.NOMBRE_COMERCIAL || creds.NOMBRE_EMISOR)}" CorreoEmisor="${xmlEscape(creds.CORREO_COPIA || '')}" AfiliacionIVA="${afiliacionIva(creds)}">
          <dte:DireccionEmisor>
            <dte:Direccion>${xmlEscape(creds.DIRECCION || 'CIUDAD')}</dte:Direccion>
            <dte:CodigoPostal>${xmlEscape(creds.CODIGO_POSTAL || '01001')}</dte:CodigoPostal>
            <dte:Municipio>${xmlEscape(creds.MUNICIPIO || 'GUATEMALA')}</dte:Municipio>
            <dte:Departamento>${xmlEscape(creds.DEPARTAMENTO || 'GUATEMALA')}</dte:Departamento>
            <dte:Pais>${xmlEscape(creds.PAIS || 'GT')}</dte:Pais>
          </dte:DireccionEmisor>
        </dte:Emisor>
        <dte:Receptor IDReceptor="${xmlEscape(nitReceptor)}" NombreReceptor="${nombreReceptor}"${correoReceptor}>
          <dte:DireccionReceptor>
            <dte:Direccion>${direccionReceptor}</dte:Direccion>
            <dte:CodigoPostal>01001</dte:CodigoPostal>
            <dte:Municipio>GUATEMALA</dte:Municipio>
            <dte:Departamento>GUATEMALA</dte:Departamento>
            <dte:Pais>GT</dte:Pais>
          </dte:DireccionReceptor>
        </dte:Receptor>
        <dte:Frases>
          <dte:Frase TipoFrase="${tipoFrase}" CodigoEscenario="${codigoEscenario}"/>
        </dte:Frases>
        <dte:Items>${lineas}
        </dte:Items>
        <dte:Totales>${totalesImpuestos}
          <dte:GranTotal>${money(granTotal)}</dte:GranTotal>
        </dte:Totales>
      </dte:DatosEmision>
    </dte:DTE>
  </dte:SAT>
</dte:GTDocumento>`;
}

function buildAnulacionXml({ documento, creds, motivo }) {
  const nitEmisor = nitSinGuion(creds.NIT_EMISOR);
  const nitReceptor = nitSinGuion(documento.NIT);
  const fechaEmision = fechaHoraFromDateString(documento.FECHA_FEL || documento.FECHA);
  const fechaAnulacion = fechaHoraGt();

  return `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTAnulacionDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1">
  <dte:SAT>
    <dte:AnulacionDTE ID="DatosCertificados">
      <dte:DatosGenerales ID="DatosAnulacion"
        NumeroDocumentoAAnular="${xmlEscape(documento.UUID)}"
        NITEmisor="${xmlEscape(nitEmisor)}"
        IDReceptor="${xmlEscape(nitReceptor)}"
        FechaEmisionDocumentoAnular="${fechaEmision}"
        FechaHoraAnulacion="${fechaAnulacion}"
        MotivoAnulacion="${xmlEscape(motivo || 'Anulación de documento')}"/>
    </dte:AnulacionDTE>
  </dte:SAT>
</dte:GTAnulacionDocumento>`;
}

function toBase64(xml) {
  return Buffer.from(String(xml), 'utf8').toString('base64');
}

async function postJson(url, { headers = {}, body, timeoutMs = 45000 } = {}) {
  if (!url) {
    throw new Error('URL de INFILE no configurada');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { descripcion: text || `Respuesta no válida (${response.status})` };
    }

    if (!response.ok && data.resultado === undefined) {
      data.resultado = false;
      data.descripcion = data.descripcion || data.mensaje || `Error HTTP ${response.status}`;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con INFILE');
    }
    throw new Error(error.message || 'No se pudo conectar con INFILE');
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCertResponse(data) {
  const resultado = data?.resultado === true || data?.resultado === 'true' || Number(data?.resultado) === 1;
  const descripcion = data?.descripcion || data?.mensaje || data?.message
    || (Array.isArray(data?.descripcion_errores) ? data.descripcion_errores.join(' ') : '')
    || (Array.isArray(data?.errores) ? data.errores.map((e) => e?.mensaje || e).join(' ') : '');

  return {
    resultado,
    uuid: data?.uuid || data?.UUID || data?.autorizacion || null,
    serie: data?.serie || data?.Serie || null,
    numero: data?.numero || data?.Numero || null,
    fecha: data?.fecha || data?.fecha_certificacion || data?.Fecha || null,
    xml: data?.xml_certificado || data?.xml || null,
    descripcion: descripcion || (resultado ? 'Certificado' : 'Error al certificar'),
    raw: data,
  };
}

async function firmarXml(creds, xml, esAnulacion = false) {
  const data = await postJson(creds.URL_FIRMA || DEFAULT_URLS.URL_FIRMA, {
    body: {
      llave: creds.LLAVE_FIRMA,
      archivo: toBase64(xml),
      codigo: creds.USUARIO_FIRMA,
      alias: creds.USUARIO_FIRMA,
      es_anulacion: esAnulacion ? 'S' : 'N',
    },
  });

  const xmlFirmado = data?.archivo || data?.xml || data?.xml_dte;
  if (!xmlFirmado) {
    throw new Error(data?.descripcion || data?.mensaje || 'INFILE no devolvió el XML firmado');
  }
  return xmlFirmado;
}

async function certificarDte(creds, xml, identificador) {
  const usarUnificado = String(creds.USAR_UNIFICADO || 'SI').toUpperCase() !== 'NO';
  const nitEmisor = nitSinGuion(creds.NIT_EMISOR);

  if (usarUnificado) {
    const data = await postJson(creds.URL_PROCESO_UNIFICADO || DEFAULT_URLS.URL_PROCESO_UNIFICADO, {
      headers: {
        usuario: creds.USUARIO_API,
        llave: creds.LLAVE_API,
        identificador,
      },
      body: {
        nit_emisor: nitEmisor,
        correo_copia: creds.CORREO_COPIA || '',
        xml_dte: toBase64(xml),
      },
    });
    return normalizeCertResponse(data);
  }

  const xmlFirmado = await firmarXml(creds, xml, false);
  const data = await postJson(creds.URL_CERTIFICACION || DEFAULT_URLS.URL_CERTIFICACION, {
    headers: {
      usuario: creds.USUARIO_API,
      llave: creds.LLAVE_API,
      identificador,
    },
    body: {
      nit_emisor: nitEmisor,
      correo_copia: creds.CORREO_COPIA || '',
      xml_dte: xmlFirmado,
    },
  });
  return normalizeCertResponse(data);
}

async function anularDte(creds, xml, identificador) {
  const usarUnificado = String(creds.USAR_UNIFICADO || 'SI').toUpperCase() !== 'NO';
  const nitEmisor = nitSinGuion(creds.NIT_EMISOR);

  if (usarUnificado) {
    const data = await postJson(creds.URL_PROCESO_UNIFICADO || DEFAULT_URLS.URL_PROCESO_UNIFICADO, {
      headers: {
        usuario: creds.USUARIO_API,
        llave: creds.LLAVE_API,
        identificador: `${identificador}-ANULA`,
      },
      body: {
        nit_emisor: nitEmisor,
        correo_copia: creds.CORREO_COPIA || '',
        xml_dte: toBase64(xml),
      },
    });
    return normalizeCertResponse(data);
  }

  const xmlFirmado = await firmarXml(creds, xml, true);
  const data = await postJson(creds.URL_ANULACION || DEFAULT_URLS.URL_ANULACION, {
    headers: {
      usuario: creds.USUARIO_API,
      llave: creds.LLAVE_API,
      identificador: `${identificador}-ANULA`,
    },
    body: {
      nit_emisor: nitEmisor,
      correo_copia: creds.CORREO_COPIA || '',
      xml_dte: xmlFirmado,
    },
  });
  return normalizeCertResponse(data);
}

async function consultarNit(creds, nit) {
  const data = await postJson(creds.URL_CONSULTA_NIT || DEFAULT_URLS.URL_CONSULTA_NIT, {
    body: {
      emisor_codigo: creds.USUARIO_API,
      emisor_clave: creds.LLAVE_API,
      nit_consulta: nitSinGuion(nit),
    },
  });

  const nombre = data?.nombre || data?.Nombre || data?.razon_social || '';
  const mensaje = data?.mensaje || data?.descripcion || data?.message || '';
  if (!nombre && mensaje && /no exist|no encontrado|inval/i.test(mensaje)) {
    throw new Error(mensaje);
  }

  return {
    nit: nitSinGuion(data?.nit || nit),
    nombre: nombre || '',
    mensaje: mensaje || (nombre ? 'NIT encontrado' : 'Sin nombre en la consulta'),
  };
}

function requireCredenciales(creds) {
  if (!creds) {
    throw new Error('No hay credenciales FEL configuradas para esta empresa');
  }
  if (!creds.NIT_EMISOR || !creds.NOMBRE_EMISOR) {
    throw new Error('Complete NIT y nombre del emisor en credenciales FEL');
  }
  if (!creds.USUARIO_API || !creds.LLAVE_API) {
    throw new Error('Complete usuario y llave API de INFILE');
  }
  if (String(creds.USAR_UNIFICADO || 'SI').toUpperCase() === 'NO' && (!creds.USUARIO_FIRMA || !creds.LLAVE_FIRMA)) {
    throw new Error('El proceso separado requiere usuario y llave de firma');
  }
}

module.exports = {
  DEFAULT_URLS,
  nitSinGuion,
  round2,
  money,
  tipoDteFromCredenciales,
  afiliacionIva,
  calcItemIva,
  buildDteXml,
  buildAnulacionXml,
  certificarDte,
  anularDte,
  consultarNit,
  requireCredenciales,
  fechaHoraGt,
  toMysqlDatetime,
};
