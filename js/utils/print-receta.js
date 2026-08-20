import { alertError } from './swal.js';
import { getPrintLogoUrl } from './empresa-logo.js';
import { getEmpresaPrintData, empresaContactHtml, empresaContactCss } from './empresa-print.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function parseDetalle(detalle) {
  if (!detalle) return { categoria: '', medicamentos: [], indicaciones: [] };
  if (typeof detalle === 'string') {
    try {
      return parseDetalle(JSON.parse(detalle));
    } catch {
      return { categoria: '', medicamentos: [], indicaciones: [] };
    }
  }
  return {
    categoria: detalle.categoria || '',
    medicamentos: Array.isArray(detalle.medicamentos) ? detalle.medicamentos : [],
    indicaciones: Array.isArray(detalle.indicaciones) ? detalle.indicaciones : [],
  };
}

function listHtml(items, emptyText) {
  if (!items.length) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul>${items.map((item) => `<li>${escapeHtml(item.descripcion || '—')}</li>`).join('')}</ul>`;
}

export function printReceta(receta, { empresa, piePagina } = {}) {
  try {
    const detalle = parseDetalle(receta.DETALLE);
    const empresaInfo = getEmpresaPrintData(empresa);
    const empresaNombre = escapeHtml(empresaInfo.nombre);
    const contactoHtml = empresaContactHtml(empresaInfo);
    const paciente = escapeHtml(receta.PACIENTE || `Paciente #${receta.CODPACIENTE || ''}`);
    const numero = escapeHtml(receta.ID || '—');
    const fecha = escapeHtml(formatFecha(receta.FECHA));
    const hora = escapeHtml(String(receta.HORA || '').slice(0, 5) || '—');
    const categoria = escapeHtml(detalle.categoria || '—');
    const fechaImpresion = escapeHtml(new Date().toLocaleString('es-GT'));
    const logoUrl = escapeHtml(getPrintLogoUrl());
    const pieTexto = String(piePagina || '').trim();
    const pieHtml = pieTexto
      ? `<div class="pie-receta">${escapeHtml(pieTexto).replace(/\n/g, '<br>')}</div>`
      : '';

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Receta #${numero}</title>
  <style>
    @page { size: letter; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      color: #1a1a1a;
      margin: 0;
    }
    .header {
      display: flex;
      gap: 16px;
      align-items: center;
      border-bottom: 2px solid #0ea5e9;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .logo { width: 72px; height: 72px; object-fit: contain; }
    h1 { font-size: 18pt; margin: 0 0 4px; }
    .muted { color: #555; font-size: 10pt; }
    ${empresaContactCss()}
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 18px;
    }
    .box {
      border: 1px solid #ccc;
      padding: 10px 12px;
    }
    .box h3 {
      margin: 0 0 6px;
      font-size: 10pt;
      text-transform: uppercase;
      color: #555;
    }
    h2 {
      font-size: 12pt;
      margin: 0 0 8px;
      color: #0c4a6e;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    section { margin-bottom: 16px; }
    ul { margin: 0; padding-left: 1.2rem; }
    li { margin-bottom: 0.35rem; }
    .empty { color: #777; font-style: italic; margin: 0; }
    .pie-receta {
      margin-top: 48px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.45;
      text-align: center;
      white-space: normal;
    }
    .foot {
      margin-top: 16px;
      font-size: 8.5pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="${logoUrl}" alt="Logo">
    <div>
      <h1>${empresaNombre}</h1>
      ${contactoHtml}
      <div class="muted">Receta médica odontológica</div>
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <h3>Paciente</h3>
      <div><strong>${paciente}</strong></div>
    </div>
    <div class="box">
      <h3>Receta</h3>
      <div>No. ${numero}</div>
      <div>Fecha: ${fecha} · Hora: ${hora}</div>
      <div>Tratamiento: ${categoria}</div>
    </div>
  </div>

  <section>
    <h2>Medicamentos</h2>
    ${listHtml(detalle.medicamentos, 'Sin medicamentos')}
  </section>

  <section>
    <h2>Indicaciones</h2>
    ${listHtml(detalle.indicaciones, 'Sin indicaciones')}
  </section>

  ${pieHtml}
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
    alertError(error.message || 'No se pudo imprimir la receta');
  }
}
