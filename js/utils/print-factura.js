import { alertError } from './swal.js';
import { getPrintLogoUrl } from './empresa-logo.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrecio(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function tipoLabel(tipo) {
  return tipo === 'FPEQ' ? 'Factura pequeño contribuyente' : 'Factura IVA';
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function printFactura(documento, { empresa, emisor } = {}) {
  try {
    const items = documento.items || [];
    const esPeq = documento.TIPO_DTE === 'FPEQ';
    const importe = Number(documento.IMPORTE) || 0;
    const iva = esPeq ? 0 : round2(importe - round2(importe / 1.12));
    const gravable = esPeq ? importe : round2(importe - iva);
    const empresaNombre = escapeHtml(emisor?.NOMBRE_COMERCIAL || emisor?.NOMBRE_EMISOR || empresa?.trim() || 'Clínica Dental');
    const nitEmisor = escapeHtml(emisor?.NIT_EMISOR || '—');
    const fechaImpresion = escapeHtml(new Date().toLocaleString('es-GT'));
    const logoUrl = escapeHtml(getPrintLogoUrl());
    const uuid = documento.UUID || '';
    const verificador = uuid
      ? `https://felpub.c.sat.gob.gt/verificador/home?nid=${encodeURIComponent(uuid)}`
      : '';

    const filas = items.length
      ? items.map((item) => `
          <tr>
            <td>${escapeHtml(item.CODPROD)}</td>
            <td>${escapeHtml(item.DESPROD)}</td>
            <td class="num">${escapeHtml(item.CANTIDAD)}</td>
            <td class="num">${escapeHtml(formatPrecio(item.PRECIO))}</td>
            <td class="num">${escapeHtml(formatPrecio(item.TOTAL))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="empty">Sin ítems</td></tr>';

    const felBlock = documento.ESTADO === 'CERTIFICADO'
      ? `
        <div class="fel">
          <div><strong>Autorización:</strong> ${escapeHtml(documento.UUID || '—')}</div>
          <div><strong>Serie FEL:</strong> ${escapeHtml(documento.SERIE_FEL || '—')}
            &nbsp; <strong>Número FEL:</strong> ${escapeHtml(documento.NUMERO_FEL || '—')}</div>
          <div><strong>Fecha de certificación:</strong> ${escapeHtml(formatFecha(documento.FECHA_FEL))}</div>
          ${verificador ? `<div class="verify">Verifique en SAT: ${escapeHtml(verificador)}</div>` : ''}
        </div>
      `
      : `<div class="fel pending">Documento ${escapeHtml(documento.ESTADO || 'PENDIENTE')} — aún no certificado ante SAT</div>`;

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${escapeHtml(documento.NUMERO || '')}</title>
  <style>
    @page { size: letter; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #1a1a1a; margin: 0; }
    .header { display: flex; gap: 16px; align-items: center; border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; }
    .logo { width: 72px; height: 72px; object-fit: contain; }
    h1 { font-size: 18pt; margin: 0 0 4px; }
    .muted { color: #555; font-size: 10pt; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .box { border: 1px solid #ccc; padding: 10px 12px; }
    .box h3 { margin: 0 0 6px; font-size: 10pt; text-transform: uppercase; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 10pt; }
    th { background: #f1f5f9; text-transform: uppercase; font-size: 8.5pt; }
    .num { text-align: right; white-space: nowrap; }
    .empty { text-align: center; color: #777; }
    .totales { width: 280px; margin-left: auto; margin-top: 12px; }
    .totales td { border: none; padding: 3px 8px; }
    .totales .total td { font-weight: 700; font-size: 12pt; border-top: 1px solid #999; }
    .fel { margin-top: 18px; padding: 10px 12px; border: 1px dashed #0ea5e9; font-size: 9.5pt; }
    .fel.pending { color: #b45309; border-color: #f59e0b; }
    .verify { margin-top: 6px; word-break: break-all; font-size: 8.5pt; }
    .foot { margin-top: 24px; font-size: 8.5pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="${logoUrl}" alt="Logo">
    <div>
      <h1>${empresaNombre}</h1>
      <div class="muted">NIT emisor: ${nitEmisor}</div>
      <div class="muted">${escapeHtml(tipoLabel(documento.TIPO_DTE))} · ${escapeHtml(documento.CONCRE || 'CONTADO')}</div>
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <h3>Cliente</h3>
      <div><strong>${escapeHtml(documento.NOMBRE)}</strong></div>
      <div>NIT: ${escapeHtml(documento.NIT || 'CF')}</div>
      <div>${escapeHtml(documento.DIRECCION || '')}</div>
    </div>
    <div class="box">
      <h3>Documento</h3>
      <div>Interno: ${escapeHtml(documento.NUMERO || '—')}</div>
      <div>Fecha: ${escapeHtml(formatFecha(documento.FECHA))}</div>
      <div>Estado: ${escapeHtml(documento.ESTADO || '—')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Tratamiento</th>
        <th class="num">Cant.</th>
        <th class="num">Precio</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>

  <table class="totales">
    ${esPeq ? '' : `
      <tr><td>Gravado</td><td class="num">${escapeHtml(formatPrecio(gravable))}</td></tr>
      <tr><td>IVA 12%</td><td class="num">${escapeHtml(formatPrecio(iva))}</td></tr>
    `}
    <tr class="total"><td>Total</td><td class="num">${escapeHtml(formatPrecio(importe))}</td></tr>
  </table>

  ${felBlock}

  <div class="foot">Impreso: ${fechaImpresion}</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alertError('El navegador bloqueó la ventana de impresión');
      return;
    }
    win.document.open();
    win.document.write(printHtml);
    win.document.close();
    win.focus();
    win.onload = () => {
      win.print();
    };
  } catch (error) {
    alertError(error.message || 'No se pudo imprimir la factura');
  }
}
