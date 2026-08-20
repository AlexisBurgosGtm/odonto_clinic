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

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function buildAbonosTable(filas) {
  if (!filas.length) {
    return '<tr><td colspan="4" class="empty">Sin registros en el periodo</td></tr>';
  }

  return filas.map((row) => `
    <tr>
      <td class="center">${escapeHtml(formatFecha(row.FECHA))}</td>
      <td>${escapeHtml(row.PACIENTE || '—')}</td>
      <td>${escapeHtml(row.OBS || '—')}</td>
      <td class="num">${escapeHtml(formatPrecio(row.MONTO))}</td>
    </tr>
  `).join('');
}

function buildGastosTable(filas) {
  if (!filas.length) {
    return '<tr><td colspan="4" class="empty">Sin registros en el periodo</td></tr>';
  }

  return filas.map((row) => `
    <tr>
      <td class="center">${escapeHtml(formatFecha(row.FECHA))}</td>
      <td>${escapeHtml(row.TIPO || '—')}</td>
      <td>${escapeHtml(row.DESCRIPCION || '—')}</td>
      <td class="num">${escapeHtml(formatPrecio(row.IMPORTE))}</td>
    </tr>
  `).join('');
}

function buildTratamientosTable(filas) {
  if (!filas.length) {
    return '<tr><td colspan="6" class="empty">Sin registros en el periodo</td></tr>';
  }

  return filas.map((row) => `
    <tr>
      <td class="center">${escapeHtml(formatFecha(row.FECHA_REALIZADO))}</td>
      <td>${escapeHtml(row.PACIENTE || '—')}</td>
      <td>${escapeHtml(row.DESPROD || '—')}</td>
      <td class="center">${escapeHtml(row.PIEZA || '—')}</td>
      <td>${escapeHtml(row.MEDICO || '—')}</td>
      <td class="num">${escapeHtml(formatPrecio(row.PRECIO_FINAL))}</td>
    </tr>
  `).join('');
}

function getReportConfig(reporte) {
  const periodo = `${MESES[reporte.mes - 1] || reporte.mes} ${reporte.anio}`;

  if (reporte.tipo === 'ABONOS CLIENTES') {
    return {
      titulo: 'Reporte de abonos de clientes',
      periodo,
      headers: ['Fecha', 'Paciente', 'Observaciones', 'Monto'],
      rowsHtml: buildAbonosTable(reporte.filas || []),
      totalLabel: 'Total abonos',
    };
  }

  if (reporte.tipo === 'GASTOS') {
    return {
      titulo: 'Reporte de gastos',
      periodo,
      headers: ['Fecha', 'Tipo', 'Descripción', 'Importe'],
      rowsHtml: buildGastosTable(reporte.filas || []),
      totalLabel: 'Total gastos',
    };
  }

  return {
    titulo: 'Reporte de tratamientos finalizados',
    periodo,
    headers: ['Fecha', 'Paciente', 'Tratamiento', 'Pieza', 'Médico', 'Precio final'],
    rowsHtml: buildTratamientosTable(reporte.filas || []),
    totalLabel: 'Total tratamientos',
  };
}

export function printReporte(reporte, { empresa } = {}) {
  try {
    if (!reporte?.tipo) {
      void alertError('No hay datos del reporte para imprimir');
      return;
    }

    const config = getReportConfig(reporte);
    const empresaInfo = getEmpresaPrintData(empresa || reporte.empresa);
    const empresaNombre = escapeHtml(empresaInfo.nombre);
    const contactoHtml = empresaContactHtml(empresaInfo);
    const titulo = escapeHtml(config.titulo);
    const periodo = escapeHtml(config.periodo);
    const total = escapeHtml(formatPrecio(reporte.total));
    const totalLabel = escapeHtml(config.totalLabel);
    const fechaImpresion = escapeHtml(new Date().toLocaleString('es-GT'));
    const logoUrl = escapeHtml(getPrintLogoUrl());

    const headerCells = config.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo} — ${periodo}</title>
  <style>
    @page { size: letter landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      color: #1a1a1a;
      margin: 0;
      line-height: 1.35;
    }
    .reporte {
      width: 100%;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 1.5px solid #334155;
    }
    .header img {
      width: 72px;
      height: auto;
      object-fit: contain;
    }
    .header-text h1 {
      font-size: 12pt;
      font-weight: 700;
      margin: 0 0 4px;
      text-transform: uppercase;
    }
    .header-text p {
      margin: 0;
      color: #334155;
      font-size: 9.5pt;
    }
    ${empresaContactCss()}
    .titulo {
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      margin: 0 0 6px;
      letter-spacing: 0.06em;
    }
    .periodo {
      text-align: center;
      font-size: 10pt;
      margin: 0 0 16px;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 6px 8px;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      text-align: left;
    }
    td.num, th.num {
      text-align: right;
      white-space: nowrap;
    }
    td.center, th.center {
      text-align: center;
      white-space: nowrap;
    }
    .empty {
      text-align: center;
      color: #64748b;
      font-style: italic;
    }
    .total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      font-size: 11pt;
      font-weight: 700;
    }
    .total-row .amount {
      color: #0f172a;
      min-width: 120px;
      text-align: right;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 8.5pt;
      color: #64748b;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="reporte">
    <div class="header">
      <img src="${logoUrl}" alt="Logo">
      <div class="header-text">
        <h1>${empresaNombre}</h1>
        ${contactoHtml}
        <p>Sistema de gestión — Clínica Dental</p>
      </div>
    </div>

    <h2 class="titulo">${titulo}</h2>
    <p class="periodo">Periodo: ${periodo}</p>

    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${config.rowsHtml}
      </tbody>
    </table>

    <div class="total-row">
      <span>${totalLabel}:</span>
      <span class="amount">${total}</span>
    </div>

    <div class="footer">Impreso el ${fechaImpresion} · ${reporte.filas?.length || 0} registro(s)</div>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const printDoc = iframe.contentWindow?.document;
    if (!printDoc) {
      document.body.removeChild(iframe);
      void alertError('No se pudo preparar la impresión');
      return;
    }

    printDoc.open();
    printDoc.write(printHtml);
    printDoc.close();

    const doPrint = () => {
      try {
        const logoImg = printDoc.querySelector('.header img');
        if (logoImg && !logoImg.complete) {
          logoImg.onload = () => iframe.contentWindow?.print();
          logoImg.onerror = () => iframe.contentWindow?.print();
        } else {
          iframe.contentWindow?.print();
        }
      } catch (err) {
        void alertError(err.message || 'Error al imprimir');
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    };

    setTimeout(doPrint, 250);
  } catch (error) {
    void alertError(error.message || 'Error al imprimir');
  }
}
